import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, collection, query, orderBy,
  onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { useMessageNotifications, requestNotificationPermission } from '../hooks/useNotifications'
import { registerFcmToken, requestMessagePush } from '../hooks/useFcm'
import { countUnreadByOthers } from '../hooks/useReadStatus'
import DailyMission from '../components/DailyMission'
import RoomStats from '../components/RoomStats'
import RankBoard from '../components/RankBoard'
import LocationMap from '../components/LocationMap'
import MoodBoard from '../components/MoodBoard'
import MusicBoard from '../components/MusicBoard'
import RoomBgmPlayer from '../components/RoomBgmPlayer'
import ScheduleCalendar from '../components/ScheduleCalendar'
import PhotoGallery from '../components/PhotoGallery'
import RoomAvatar from '../components/RoomAvatar'
import { useUserProfiles } from '../hooks/useUserProfiles'
import { uploadToCloudinary, uploadAudioToCloudinary } from '../utils/cloudinary'
import { generateJoinCode, normalizeJoinCode, isValidJoinCodeFormat } from '../utils/joinCode'
import { awardMessagePoints } from '../utils/roomPoints'
import { postJoinWelcome } from '../utils/rankEvents'
import type { RoomRankData } from '../utils/roomPoints'
import { getAvailableReactions, getRankAvatarClass, getRankBubbleClass, getRankPerks, getRankLevel } from '../utils/rankSystem'
import {
  canMute, canSalute, buildMuteEventText, buildSaluteEventText,
  getRankName, formatRankHonorificName, MUTE_DURATION_MS, MUTE_COOLDOWN_MS, SALUTE_COOLDOWN_MS,
  type RoomMute,
} from '../utils/rankPowers'
import RankBadge from '../components/RankBadge'
import ChatBanners from '../components/ChatBanners'
import PollMessage from '../components/PollMessage'
import { FeatureModals, ChatFeatureBar } from '../components/FeatureModals'
import { useRoomExtras } from '../hooks/useRoomExtras'
import { parseMentionIds, renderTextWithMentions } from '../utils/mentions'
import RoomBottomNav, { TAB_TITLES, MORE_SUB_TABS, type RoomTab, type PrimaryTab, type MoreSubTab } from '../components/RoomBottomNav'
import RoomMorePanel from '../components/RoomMorePanel'
import { ChevronLeft, Search } from 'lucide-react'
interface Reaction {
  [emoji: string]: string[] // emoji -> uid[]
}

interface ReplyTo {
  id: string
  authorName: string
  text: string
  imageURL?: string
  audioURL?: string
}

interface Message {
  id: string
  text: string
  imageURL?: string
  audioURL?: string
  audioDuration?: number
  authorId: string
  authorName: string
  authorPhotoURL?: string
  createdAt: { seconds: number } | null
  reactions?: Reaction
  replyTo?: ReplyTo
  type?: 'rank_event'
  messageType?: 'rank_event' | 'poll'
  event?: 'mute' | 'salute' | 'reprimand' | 'gubo' | 'promotion' | 'rebellion' | 'mvp' | 'group_goal' | 'weekly_champion' | 'join'
  pollQuestion?: string
  pollOptions?: string[]
  pollVotes?: Record<string, string[]>
  mentions?: string[]
}

function isRankEventMessage(msg: Message): boolean {
  return msg.messageType === 'rank_event' || msg.type === 'rank_event'
}

/** 폰이 오래 잠들었다 깨어난 직후처럼 연결이 막 복구되는 타이밍에 첫 시도가
 * 실패하는 경우가 있어, 곧바로 실패 처리하지 않고 짧게 대기 후 한 번 더 시도한다. */
async function withOneRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.warn('[WURI] 첫 시도 실패, 1.2초 후 재시도', err)
    await new Promise((r) => setTimeout(r, 1200))
    return await fn()
  }
}

interface Room {
  name: string
  emoji?: string
  photoURL?: string
  joinCode?: string
  memberIds: string[]
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthState()
  const { dark, toggleDark } = useTheme()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [roomError, setRoomError] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinPassword, setJoinPassword] = useState('')
  const [joinPasswordError, setJoinPasswordError] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [changingPhoto, setChangingPhoto] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  // 푸시 토큰이 등록되면 백그라운드/종료 상태 알림은 서비스워커가 담당하므로
  // 로컬(탭 열려있을 때만 동작하는) 알림은 중복을 막기 위해 끈다.
  const [pushReady, setPushReady] = useState(false)
  // iOS 홈 화면 앱(standalone)에서는 alert()가 안 뜨는 경우가 있어 직접 모달로 진단 결과를 보여준다.
  const [pushDiagnostic, setPushDiagnostic] = useState<string | null>(null)
  const [featureModal, setFeatureModal] = useState<'poll' | 'schedule' | 'birthday' | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [activeTab, setActiveTab] = useState<RoomTab>('chat')
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<Message | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIdx, setSearchIdx] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [viewingProfile, setViewingProfile] = useState<{ name: string; photoURL?: string; userId?: string } | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null)
  const [memberReadAt, setMemberReadAt] = useState<Record<string, number>>({})
  const [typingRaw, setTypingRaw] = useState<Record<string, { userName: string; updatedAt: number }>>({})
  const [, setTypingTick] = useState(0)
  const [memberRanks, setMemberRanks] = useState<Record<string, RoomRankData>>({})
  const [myMute, setMyMute] = useState<RoomMute | null>(null)
  const [, setMuteTick] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roomPhotoInputRef = useRef<HTMLInputElement>(null)
  const muteCooldownRef = useRef<Record<string, number>>({})
  const saluteCooldownRef = useRef(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recordingSecondsRef = useRef(0)
  const shouldSendRecordingRef = useRef(false)
  const memberProfiles = useUserProfiles(room?.memberIds ?? [])

  const REACTION_EMOJIS = useMemo(
    () => getAvailableReactions(memberRanks[user?.uid ?? '']?.points ?? 0),
    [memberRanks, user?.uid],
  )
  const myPoints = useMemo(() => memberRanks[user?.uid ?? '']?.points ?? 0, [memberRanks, user?.uid])
  const honorific = (name: string, memberPoints: number) => formatRankHonorificName(name, memberPoints, myPoints)
  const authorLabel = (name: string, _uid: string, points: number) => honorific(name, points)

  const extras = useRoomExtras(
    roomId,
    user,
    room?.memberIds ?? [],
    memberProfiles,
    toast,
  )

  const openProfile = (name: string, photoURL?: string, userId?: string) => {
    setViewingProfile({ name, photoURL, userId })
  }

  const getMemberPoints = (uid: string) => memberRanks[uid]?.points ?? 0

  const handleMute = async (targetId: string, targetName: string) => {
    if (!user || !roomId || targetId === user.uid) return
    const myPoints = getMemberPoints(user.uid)
    const targetPoints = getMemberPoints(targetId)
    if (!canMute(myPoints, targetPoints)) {
      toast('계급이 더 높을 때만 벙어리를 쓸 수 있어요')
      return
    }
    const key = `${user.uid}_${targetId}`
    if ((muteCooldownRef.current[key] ?? 0) > Date.now()) {
      toast('같은 사람에게는 1분에 한 번만!')
      return
    }
    const actorRankName = getRankName(myPoints)
    try {
      await setDoc(doc(db, 'rooms', roomId, 'mutes', targetId), {
        byUserId: user.uid,
        byUserName: user.displayName || '친구',
        byRankName: actorRankName,
        until: Date.now() + MUTE_DURATION_MS,
      })
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        messageType: 'rank_event',
        event: 'mute',
        text: buildMuteEventText(user.displayName || '친구', actorRankName, targetName),
        authorId: user.uid,
        authorName: user.displayName || '친구',
        authorPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      })
      muteCooldownRef.current[key] = Date.now() + MUTE_COOLDOWN_MS
      setReactionTarget(null)
      toast(`${targetName}님 벙어리! 🤐`)
    } catch {
      toast('벙어리 실패… 다시 시도해 주세요')
    }
  }

  const handleSalute = async (targetId: string, targetName: string) => {
    if (!user || !roomId) {
      toast('잠시 후 다시 시도해 주세요')
      return
    }
    if (targetId === user.uid) return
    const myPoints = getMemberPoints(user.uid)
    const targetPoints = getMemberPoints(targetId)
    if (!canSalute(myPoints, targetPoints)) {
      toast('계급·점수가 더 높은 분에게만 경례할 수 있어요')
      return
    }
    if (saluteCooldownRef.current > Date.now()) {
      toast('경례는 30초마다 한 번!')
      return
    }
    const actorRankName = getRankName(myPoints)
    const targetRankName = getRankName(targetPoints)
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        messageType: 'rank_event',
        event: 'salute',
        text: buildSaluteEventText(
          user.displayName || '친구',
          actorRankName,
          targetName,
          targetRankName,
        ),
        authorId: user.uid,
        authorName: user.displayName || '친구',
        authorPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      })
      saluteCooldownRef.current = Date.now() + SALUTE_COOLDOWN_MS
      setViewingProfile(null)
      toast('경례! 🫡')
    } catch {
      toast('경례 실패… 다시 시도해 주세요')
    }
  }

  const muteRemainingSec = myMute
    ? Math.max(0, Math.ceil((myMute.until - Date.now()) / 1000))
    : 0
  const isMuted = muteRemainingSec > 0

  const getReplyPreview = (msg: Pick<Message, 'text' | 'imageURL' | 'audioURL'>) => {
    if (msg.imageURL) return '📷 사진'
    if (msg.audioURL) return '🎤 음성 메시지'
    const t = msg.text.trim()
    return t.length > 60 ? `${t.slice(0, 60)}…` : t
  }

  const startReply = (msg: Message) => {
    setReplyTarget(msg)
    setReactionTarget(null)
  }

  const deleteMessage = async (msg: Message) => {
    if (!user || !roomId || msg.authorId !== user.uid) return
    setDeleteTarget(msg)
  }

  const confirmDeleteMessage = async () => {
    if (!deleteTarget || !roomId) return
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'messages', deleteTarget.id))
      setReactionTarget(null)
    } catch {
      toast('메시지 삭제에 실패했어요')
    } finally {
      setDeleteTarget(null)
    }
  }

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return messages.filter(
      (m) => m.text.toLowerCase().includes(q) || m.authorName.toLowerCase().includes(q),
    )
  }, [messages, searchQuery])

  useEffect(() => {
    setSearchIdx(0)
  }, [searchQuery])

  useEffect(() => {
    if (!showSearch || searchResults.length === 0) return
    const target = searchResults[searchIdx]
    if (!target) return
    setHighlightId(target.id)
    messageRefs.current.get(target.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setHighlightId(null), 1800)
    return () => clearTimeout(t)
  }, [searchIdx, searchResults, showSearch])

  const closeSearch = () => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchIdx(0)
    setHighlightId(null)
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const lower = text.toLowerCase()
    const q = query.trim().toLowerCase()
    const idx = lower.indexOf(q)
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-amber-200 dark:bg-amber-500/40 text-inherit rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  const renderReplyQuote = (reply: ReplyTo, isMine: boolean) => {
    const replyAuthorPoints = messages.find((m) => m.id === reply.id)?.authorId
      ? getMemberPoints(messages.find((m) => m.id === reply.id)!.authorId)
      : 0
    return (
    <div className={`rounded-lg px-2.5 py-2 mb-2 ${isMine ? 'bg-black/15' : 'bg-gray-100 dark:bg-white/10'}`}>
      <p className={`text-[11px] font-semibold leading-tight mb-0.5 ${isMine ? 'text-white/90' : 'text-violet-500 dark:text-violet-400'}`}>
        {honorific(reply.authorName, replyAuthorPoints)}
      </p>
      <p className={`text-xs leading-snug line-clamp-2 ${isMine ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'}`}>
        {reply.imageURL ? '📷 사진' : reply.audioURL ? '🎤 음성 메시지' : reply.text}
      </p>
    </div>
    )
  }

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user || !roomId) return
    const msgRef = doc(db, 'rooms', roomId, 'messages', msgId)
    const msg = messages.find((m) => m.id === msgId)
    const current = msg?.reactions?.[emoji] ?? []
    const hasReacted = current.includes(user.uid)
    try {
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.uid) : arrayUnion(user.uid),
      })
      setReactionTarget(null)
    } catch {
      toast('반응을 남기지 못했어요')
    }
  }

  useMessageNotifications(messages, user?.uid, room?.name ?? '우리방', notificationsEnabled && !pushReady)

  const enableNotifications = async () => {
    setPushDiagnostic('확인 중...')
    const result = await requestNotificationPermission()
    if (result === 'unsupported') {
      setPushDiagnostic('이 브라우저는 알림을 지원하지 않아요')
      return
    }
    if (result === 'granted') {
      setNotificationsEnabled(true)
      localStorage.setItem('wuri_notifications', '1')
      if (!user) {
        setPushDiagnostic('진단 실패: 로그인 정보(user)를 못 찾았어요. 화면을 새로고침한 뒤 다시 시도해주세요.')
        return
      }
      const { token, reason } = await registerFcmToken(user.uid)
      setPushReady(Boolean(token))
      if (token) {
        setPushDiagnostic(
          `✅ 푸시 등록 성공\n토큰: ${token.slice(0, 24)}...\n\n앱을 나가거나 종료해도 새 메시지를 알려줘요.`,
        )
      } else {
        setPushDiagnostic(`❌ 푸시 등록 실패\n사유: ${reason ?? '알 수 없음'}`)
      }
      return
    }
    setPushDiagnostic('설정에서 알림을 허용해주세요')
  }

  // 알림을 이미 허용한 상태로 재방문한 경우 푸시 토큰을 조용히 재등록(만료 대비)
  useEffect(() => {
    if (!user || !notificationsEnabled) return
    registerFcmToken(user.uid).then(({ token }) => setPushReady(Boolean(token))).catch(() => {})
  }, [user, notificationsEnabled])

  useEffect(() => {
    if (!roomId) return
    return onSnapshot(
      doc(db, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) {
          setRoom(null)
          setRoomError('방을 찾을 수 없어요')
          return
        }
        setRoom(snap.data() as Room)
        setRoomError('')
      },
      () => setRoomError('방 정보를 불러올 수 없어요'),
    )
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    return onSnapshot(collection(db, 'rooms', roomId, 'ranks'), (snap) => {
      const map: Record<string, RoomRankData> = {}
      snap.docs.forEach((d) => { map[d.id] = d.data() as RoomRankData })
      setMemberRanks(map)
    })
  }, [roomId])

  useEffect(() => {
    if (!roomId || !user) return
    return onSnapshot(doc(db, 'rooms', roomId, 'mutes', user.uid), (snap) => {
      if (!snap.exists()) {
        setMyMute(null)
        return
      }
      const data = snap.data() as RoomMute
      if (data.until <= Date.now()) {
        setMyMute(null)
        deleteDoc(snap.ref).catch(() => {})
      } else {
        setMyMute(data)
      }
    })
  }, [roomId, user])

  useEffect(() => {
    if (!myMute) return
    const t = setInterval(() => {
      if (myMute.until <= Date.now()) {
        setMyMute(null)
        if (roomId && user) deleteDoc(doc(db, 'rooms', roomId, 'mutes', user.uid)).catch(() => {})
      } else {
        setMuteTick((n) => n + 1)
      }
    }, 500)
    return () => clearInterval(t)
  }, [myMute, roomId, user])

  // 기존 방에 비밀번호 없으면 멤버가 열 때 자동 생성
  useEffect(() => {
    if (!user || !roomId || !room || room.joinCode) return
    if (!room.memberIds.includes(user.uid)) return
    const code = generateJoinCode()
    updateDoc(doc(db, 'rooms', roomId), { joinCode: code }).catch(() => {})
  }, [user, roomId, room?.joinCode, room?.memberIds])

  useEffect(() => {
    if (!roomId) return
    const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)))
    })
  }, [roomId])

  useEffect(() => {
    if (!roomId) return
    return onSnapshot(collection(db, 'rooms', roomId, 'readStatus'), (snap) => {
      const map: Record<string, number> = {}
      snap.docs.forEach((d) => {
        const ts = d.data().lastReadAt as { seconds: number } | undefined
        if (ts?.seconds) map[d.id] = ts.seconds * 1000
      })
      setMemberReadAt(map)
    })
  }, [roomId])

  // 채팅 탭에서 메시지 보면 읽음 처리
  useEffect(() => {
    if (!user || !roomId || activeTab !== 'chat' || messages.length === 0) return
    const latest = messages[messages.length - 1]
    if (!latest.createdAt) return
    setDoc(
      doc(db, 'rooms', roomId, 'readStatus', user.uid),
      { userId: user.uid, lastReadAt: latest.createdAt },
      { merge: true },
    ).catch(() => {})
  }, [user, roomId, activeTab, messages])

  useEffect(() => {
    if (!roomId) return
    return onSnapshot(collection(db, 'rooms', roomId, 'typing'), (snap) => {
      const map: Record<string, { userName: string; updatedAt: number }> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = { userName: data.userName as string, updatedAt: data.updatedAt as number }
      })
      setTypingRaw(map)
    })
  }, [roomId])

  useEffect(() => {
    const id = setInterval(() => setTypingTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (user && roomId) deleteDoc(doc(db, 'rooms', roomId, 'typing', user.uid)).catch(() => {})
    }
  }, [user, roomId])

  const clearTyping = () => {
    if (!user || !roomId) return
    deleteDoc(doc(db, 'rooms', roomId, 'typing', user.uid)).catch(() => {})
  }

  const handleTyping = () => {
    if (!user || !roomId || activeTab !== 'chat') return
    setDoc(doc(db, 'rooms', roomId, 'typing', user.uid), {
      userName: user.displayName || '친구',
      updatedAt: Date.now(),
    }).catch(() => {})
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(clearTyping, 3000)
  }

  const typingUsers = Object.entries(typingRaw)
    .filter(([uid, t]) => uid !== user?.uid && Date.now() - t.updatedAt < 4000)
    .map(([uid, t]) => ({ userId: uid, userName: t.userName }))

  useEffect(() => {
    if (activeTab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !roomId || !text.trim() || isMuted) return
    setSending(true)
    const msgText = text.trim()
    try {
      const mentions = parseMentionIds(msgText, memberProfiles)
      const payload: Record<string, unknown> = {
        text: msgText,
        authorId: user.uid,
        authorName: user.displayName || '친구',
        authorPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        mentions,
      }
      if (replyTarget) {
        payload.replyTo = {
          id: replyTarget.id,
          authorName: replyTarget.authorName,
          text: replyTarget.text,
          ...(replyTarget.imageURL ? { imageURL: replyTarget.imageURL } : {}),
          ...(replyTarget.audioURL ? { audioURL: replyTarget.audioURL } : {}),
        }
      }
      await withOneRetry(() => addDoc(collection(db, 'rooms', roomId, 'messages'), payload))
      awardMessagePoints(roomId, user.uid, user.displayName || '친구').catch(() => {})
      requestMessagePush({
        roomId,
        senderId: user.uid,
        senderName: user.displayName || '친구',
        roomName: room?.name,
        text: msgText,
      })
      setText('')
      setReplyTarget(null)
      clearTyping()
    } catch (err) {
      console.error('[WURI] 메시지 전송 실패', err)
      toast('메시지 전송에 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setSending(false)
    }
  }

  const sendImage = async (file: File) => {
    if (!user || !roomId || isMuted) return
    setSending(true)
    try {
      const imageURL = await uploadToCloudinary(file)
      const payload: Record<string, unknown> = {
        text: '',
        imageURL,
        authorId: user.uid,
        authorName: user.displayName || '친구',
        authorPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      }
      if (replyTarget) {
        payload.replyTo = {
          id: replyTarget.id,
          authorName: replyTarget.authorName,
          text: replyTarget.text,
          ...(replyTarget.imageURL ? { imageURL: replyTarget.imageURL } : {}),
          ...(replyTarget.audioURL ? { audioURL: replyTarget.audioURL } : {}),
        }
      }
      await withOneRetry(() => addDoc(collection(db, 'rooms', roomId, 'messages'), payload))
      awardMessagePoints(roomId, user.uid, user.displayName || '친구').catch(() => {})
      requestMessagePush({
        roomId,
        senderId: user.uid,
        senderName: user.displayName || '친구',
        roomName: room?.name,
        imageURL,
      })
      setReplyTarget(null)
    } catch (err) {
      console.error('[WURI] 사진 전송 실패', err)
      toast('사진 전송에 실패했어요. 용량이나 네트워크를 확인해주세요')
    } finally {
      setSending(false)
    }
  }

  const sendAudio = async (blob: Blob, duration: number) => {
    if (!user || !roomId || isMuted) return
    setSending(true)
    try {
      const audioURL = await uploadAudioToCloudinary(blob)
      const payload: Record<string, unknown> = {
        text: '',
        audioURL,
        audioDuration: duration,
        authorId: user.uid,
        authorName: user.displayName || '친구',
        authorPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      }
      if (replyTarget) {
        payload.replyTo = {
          id: replyTarget.id,
          authorName: replyTarget.authorName,
          text: replyTarget.text,
          ...(replyTarget.imageURL ? { imageURL: replyTarget.imageURL } : {}),
          ...(replyTarget.audioURL ? { audioURL: replyTarget.audioURL } : {}),
        }
      }
      await withOneRetry(() => addDoc(collection(db, 'rooms', roomId, 'messages'), payload))
      awardMessagePoints(roomId, user.uid, user.displayName || '친구').catch(() => {})
      requestMessagePush({
        roomId,
        senderId: user.uid,
        senderName: user.displayName || '친구',
        roomName: room?.name,
        audioURL,
      })
      setReplyTarget(null)
    } catch (err) {
      console.error('[WURI] 음성 메시지 전송 실패', err, { blobType: blob.type, blobSize: blob.size })
      const reason = (err as { message?: string })?.message
      const detail = `(${blob.type || '알수없음'}, ${Math.round(blob.size / 1024)}KB)`
      toast(reason ? `음성 메시지 전송 실패: ${reason} ${detail}` : `음성 메시지 전송에 실패했어요 ${detail}`)
    } finally {
      setSending(false)
    }
  }

  const MAX_RECORDING_SECONDS = 120

  const pickAudioMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return undefined
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
    return candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
  }

  const finishRecording = (send: boolean) => {
    shouldSendRecordingRef.current = send
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
    setRecordingSeconds(0)
  }

  const startRecording = async () => {
    if (!user || isMuted || sending || isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickAudioMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      audioChunksRef.current = []
      recordingSecondsRef.current = 0
      shouldSendRecordingRef.current = false

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const duration = recordingSecondsRef.current
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        audioChunksRef.current = []
        if (!shouldSendRecordingRef.current || duration < 1) return
        // 아주 짧게 녹음하면 인코더가 아직 오디오 프레임을 못 만든 채로 끝나서
        // 헤더만 있는 빈 파일이 나올 수 있다 — 업로드해서 헷갈리는 서버 에러를
        // 받는 대신 여기서 바로 알려준다.
        if (blob.size < 1000) {
          toast('녹음이 너무 짧아요. 조금 더 길게 녹음해주세요 🎤')
          return
        }
        sendAudio(blob, duration)
      }

      // timeslice(250ms)를 줘서 녹음 도중 주기적으로 데이터를 받는다 — 인자 없이
      // start()하면 정지 시점에 한 번에만 데이터가 나오는데, 일부 모바일 브라우저는
      // 이때 인코더 플러시가 안 끝나 빈 파일이 되는 경우가 있어 훨씬 안정적이다.
      recorder.start(250)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingSeconds(0)
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1
        setRecordingSeconds(recordingSecondsRef.current)
        if (recordingSecondsRef.current >= MAX_RECORDING_SECONDS) finishRecording(true)
      }, 1000)
    } catch {
      toast('마이크 권한을 허용해주세요 🎤')
    }
  }

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      mediaRecorderRef.current?.stop()
    }
  }, [])

  const formatRecordingTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const changeRoomPhoto = async (file: File) => {
    if (!roomId) return
    setChangingPhoto(true)
    try {
      const photoURL = await uploadToCloudinary(file)
      await updateDoc(doc(db, 'rooms', roomId), { photoURL })
    } catch {
      alert('방 사진 변경에 실패했어요. 다시 시도해주세요.')
    } finally {
      setChangingPhoto(false)
      if (roomPhotoInputRef.current) roomPhotoInputRef.current.value = ''
    }
  }

  const joinRoom = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!user || !roomId || !room) return
    if (!room.joinCode) {
      setJoinPasswordError('비밀번호를 준비 중이에요. 잠시 후 다시 시도해주세요.')
      return
    }
    const code = normalizeJoinCode(joinPassword)
    if (!isValidJoinCodeFormat(code)) {
      setJoinPasswordError('영문과 숫자를 섞어 4~12자로 입력해주세요.')
      return
    }
    if (room.joinCode !== code) {
      setJoinPasswordError('비밀번호가 틀렸어요.')
      return
    }
    setJoining(true)
    setJoinPasswordError('')
    try {
      await updateDoc(doc(db, 'rooms', roomId), { memberIds: arrayUnion(user.uid) })
      await postJoinWelcome(roomId, {
        uid: user.uid,
        name: user.displayName || '친구',
        photoURL: user.photoURL,
      })
      setJoinPassword('')
    } catch {
      setJoinPasswordError('참여에 실패했어요. 다시 시도해주세요.')
    } finally {
      setJoining(false)
    }
  }

  const leaveRoom = async () => {
    if (!user || !roomId) return
    setShowLeave(false)
    try {
      await updateDoc(doc(db, 'rooms', roomId), { memberIds: arrayRemove(user.uid) })
      navigate('/')
    } catch {
      alert('방 나가기에 실패했어요. 다시 시도해주세요.')
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyJoinCode = () => {
    if (!room?.joinCode) return
    navigator.clipboard.writeText(room.joinCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const openRename = () => {
    setRenameValue(room?.name ?? '')
    setShowRename(true)
  }

  const handlePrimaryTab = (tab: PrimaryTab) => {
    setActiveTab(tab)
  }

  const handleMoreSubTab = (tab: MoreSubTab) => {
    setActiveTab(tab)
  }

  const headerTitle = activeTab === 'chat' ? room?.name ?? '채팅' : TAB_TITLES[activeTab]
  const showBackToMore = MORE_SUB_TABS.includes(activeTab as typeof MORE_SUB_TABS[number])

  const renameRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomId || !renameValue.trim()) return
    setRenaming(true)
    try {
      await updateDoc(doc(db, 'rooms', roomId), { name: renameValue.trim() })
      setShowRename(false)
    } finally {
      setRenaming(false)
    }
  }

  const formatTime = (ts: { seconds: number } | null) => {
    if (!ts) return ''
    return new Date(ts.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (ts: { seconds: number } | null) => {
    if (!ts) return ''
    const d = new Date(ts.seconds * 1000)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return '오늘'
    if (d.toDateString() === yesterday.toDateString()) return '어제'
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  if (roomError && !room) return (
    <div className="page-enter app-shell min-h-screen flex flex-col max-w-md mx-auto items-center justify-center px-6 text-center safe-top">
      <div className="card p-8 w-full">
        <div className="text-4xl mb-4">🚪</div>
        <p className="font-bold text-[var(--text)] mb-2">{roomError}</p>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          링크가 올바른지 확인하거나<br />방장에게 다시 초대를 요청해주세요.
        </p>
        <button type="button" onClick={() => navigate('/')} className="btn btn-primary w-full">
          홈으로
        </button>
      </div>
    </div>
  )

  if (!room) return (
    <div className="h-full bg-gray-50 dark:bg-[#0d0d0d] flex flex-col max-w-md mx-auto animate-pulse overflow-hidden">
      <div className="h-14 bg-white dark:bg-white/5 border-b border-gray-100 dark:border-white/10 flex items-center px-4 gap-3">
        <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg" />
        <div className="flex-1 h-4 bg-gray-200 dark:bg-white/10 rounded-lg w-1/3" />
      </div>
      <div className="flex-1 px-4 py-6 space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-full shrink-0" />
            <div className={`h-10 bg-gray-200 dark:bg-white/10 rounded-2xl ${i % 2 === 0 ? 'w-2/5' : 'w-3/5'}`} />
          </div>
        ))}
      </div>
    </div>
  )

  const isJoined = user && room.memberIds.includes(user.uid)

  return (
    <div className="page-enter flex-1 min-h-0 w-full bg-[var(--surface-2)] flex flex-col max-w-md mx-auto overflow-hidden">
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <img
            src={viewingPhoto}
            alt="사진"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setViewingPhoto(null)}
            className="absolute top-6 right-6 text-white/80 text-2xl px-2 safe-top"
          >
            ✕
          </button>
        </div>
      )}

      {/* 프로필 보기 모달 */}
      {viewingProfile && (
        <div
          className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setViewingProfile(null)}
        >
          <div className={`flex flex-col items-center gap-4 profile-rank-wrap profile-rank-${getRankLevel(viewingProfile.userId ? getMemberPoints(viewingProfile.userId) : 0)}`} onClick={(e) => e.stopPropagation()}>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-violet-200 relative">
              <div className="profile-rank-bg absolute inset-0 opacity-30" />
              {viewingProfile.photoURL
                ? <img src={viewingProfile.photoURL} alt={viewingProfile.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-violet-600">{viewingProfile.name[0]}</div>
              }
            </div>
            <p className="text-white text-xl font-bold">
              {viewingProfile.userId
                ? honorific(viewingProfile.name, getMemberPoints(viewingProfile.userId))
                : viewingProfile.name}
            </p>
            {viewingProfile.userId && (
              <div className="text-center space-y-2">
                {memberRanks[viewingProfile.userId]
                  ? <>
                      <RankBadge rank={memberRanks[viewingProfile.userId]} size="md" />
                      <p className="text-white/70 text-sm">{memberRanks[viewingProfile.userId].points}점</p>
                      <div className="flex flex-wrap justify-center gap-1.5 max-w-xs">
                        {getRankPerks(memberRanks[viewingProfile.userId].points).perkLabels.map((label) => (
                          <span key={label} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">{label}</span>
                        ))}
                      </div>
                    </>
                  : <RankBadge rank={{ rankName: '이병', points: 0 }} size="md" />}
              </div>
            )}
            {viewingProfile.userId && user && viewingProfile.userId !== user.uid && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {canMute(getMemberPoints(user.uid), getMemberPoints(viewingProfile.userId)) && (
                  <button
                    type="button"
                    onClick={() => { handleMute(viewingProfile.userId!, viewingProfile.name); setViewingProfile(null) }}
                    className="px-4 py-2 rounded-xl bg-rose-500/90 text-white text-sm font-bold active:scale-95 transition-transform"
                  >
                    🤐 벙어리 10초
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSalute(viewingProfile.userId!, viewingProfile.name)}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-bold active:scale-95 transition-transform ${
                    canSalute(getMemberPoints(user.uid), getMemberPoints(viewingProfile.userId))
                      ? 'bg-emerald-600/90'
                      : 'bg-gray-500/50'
                  }`}
                >
                  🫡 경례
                </button>
              </div>
            )}
            {viewingProfile.userId === user?.uid && (
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                <button type="button" onClick={() => setFeatureModal('birthday')} className="px-3 py-1.5 rounded-lg bg-white/15 text-white text-xs font-bold">🎂 생일</button>
              </div>
            )}
            <button onClick={() => setViewingProfile(null)} className="text-white/60 text-sm mt-2">닫기</button>
          </div>
        </div>
      )}

      {/* 상단: 헤더 + BGM */}
      <div className="room-top-dock safe-top sticky top-0 z-10 shrink-0">
        <header className="app-header">
        {showSearch && activeTab === 'chat' ? (
          <div className="px-3 py-2.5 flex items-center gap-2">
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메시지 검색..."
              className="input-field flex-1 min-w-0 py-2"
            />
            {searchResults.length > 0 && (
              <span className="text-[11px] text-[var(--text-muted)] shrink-0 tabular-nums">
                {searchIdx + 1}/{searchResults.length}
              </span>
            )}
            <button type="button" disabled={searchResults.length === 0} onClick={() => setSearchIdx((i) => (i - 1 + searchResults.length) % searchResults.length)} className="icon-btn disabled:opacity-30">↑</button>
            <button type="button" disabled={searchResults.length === 0} onClick={() => setSearchIdx((i) => (i + 1) % searchResults.length)} className="icon-btn disabled:opacity-30">↓</button>
            <button type="button" onClick={closeSearch} className="text-sm text-[var(--brand)] font-semibold px-2 shrink-0">취소</button>
          </div>
        ) : (
          <div className="px-3 py-2.5 flex items-center gap-2">
            <button type="button" onClick={() => showBackToMore ? setActiveTab('more') : navigate('/')} className="icon-btn shrink-0">
              <ChevronLeft size={22} />
            </button>
            {activeTab === 'chat' && (
              <RoomAvatar photoURL={room.photoURL} emoji={room.emoji} name={room.name} className="w-9 h-9 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[var(--text)] truncate text-[15px]">{headerTitle}</p>
              {activeTab === 'chat' && memberRanks[user?.uid ?? ''] && (
                <RankBadge rank={memberRanks[user!.uid]} />
              )}
            </div>
            {activeTab === 'chat' && (
              <button type="button" onClick={() => setShowSearch(true)} className="icon-btn shrink-0">
                <Search size={20} />
              </button>
            )}
          </div>
        )}
        </header>
        {isJoined && roomId && <RoomBgmPlayer roomId={roomId} />}
      </div>

      {!isJoined ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
          <RoomAvatar photoURL={room.photoURL} emoji={room.emoji} name={room.name} className="w-20 h-20 mb-4" />
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">{room.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">방 비밀번호를 입력하고 참여하세요</p>
          <form onSubmit={joinRoom} className="w-full max-w-xs space-y-3">
            <input
              type="text"
              value={joinPassword}
              onChange={(e) => { setJoinPassword(e.target.value.toUpperCase()); setJoinPasswordError('') }}
              placeholder="예: K3M8P2"
              maxLength={12}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 uppercase tracking-[0.2em] text-center font-bold"
              style={{ fontSize: '16px' }}
              autoFocus
            />
            {joinPasswordError && (
              <p className="text-sm text-rose-500">{joinPasswordError}</p>
            )}
            <button
              type="submit"
              disabled={joining || !joinPassword.trim()}
              className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-bold transition-colors"
            >
              {joining ? '참여 중...' : '참여하기'}
            </button>
          </form>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 leading-relaxed">
            비밀번호는 방장에게 물어보세요.<br />홈에서 🔑 비밀번호로 참여도 가능해요.
          </p>
        </div>
      ) : (
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chat' && (
          <>
            {room && (
              <ChatBanners meta={extras.meta} />
            )}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" onClick={() => setReactionTarget(null)}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center text-3xl">💬</div>
                  <p className="font-semibold text-gray-500 dark:text-gray-400">아직 대화가 없어요</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 text-center">첫 메시지로 대화를 시작해보세요!</p>
                </div>
              )}
              {showSearch && searchQuery.trim() && searchResults.length === 0 && messages.length > 0 && (
                <div className="text-center py-10 text-sm text-gray-400 dark:text-gray-500">
                  &quot;{searchQuery}&quot; 검색 결과가 없어요
                </div>
              )}
              {messages.map((msg, idx) => {
                if (isRankEventMessage(msg)) {
                  return (
                    <div key={msg.id} className="flex justify-center my-1">
                      <p className={`rank-event rank-event-${msg.event ?? 'mute'} text-xs px-3 py-1.5 rounded-full`}>
                        {msg.text}
                      </p>
                    </div>
                  )
                }

                if (msg.messageType === 'poll' && msg.pollOptions?.length) {
                  return (
                    <div key={msg.id} className={`flex ${msg.authorId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                      <PollMessage
                        question={msg.pollQuestion ?? msg.text}
                        options={msg.pollOptions}
                        votes={msg.pollVotes ?? {}}
                        myUid={user?.uid}
                        onVote={(i) => extras.votePoll(msg.id, i, msg.pollVotes ?? {})}
                      />
                    </div>
                  )
                }

                const isMine = msg.authorId === user?.uid
                const authorPoints = memberRanks[msg.authorId]?.points ?? 0
                const authorRank = memberRanks[msg.authorId]
                const unreadByOthers = isMine && room
                  ? countUnreadByOthers(msg, room.memberIds, memberReadAt)
                  : 0
                const prevMsg = idx > 0 ? messages[idx - 1] : null
                const showDateLabel = !prevMsg || (
                  msg.createdAt && prevMsg.createdAt &&
                  new Date(msg.createdAt.seconds * 1000).toDateString() !==
                  new Date(prevMsg.createdAt.seconds * 1000).toDateString()
                )
                return (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      if (el) messageRefs.current.set(msg.id, el)
                      else messageRefs.current.delete(msg.id)
                    }}
                    className={`transition-all duration-300 ${highlightId === msg.id ? 'ring-2 ring-amber-400 dark:ring-amber-500 rounded-2xl' : ''}`}
                  >
                    {showDateLabel && msg.createdAt && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
                        <span className="text-xs text-gray-400 dark:text-gray-600 font-medium px-2">{formatDateLabel(msg.createdAt)}</span>
                        <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
                      </div>
                    )}
                    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMine && (
                        <div
                          className={`w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 mt-1 cursor-pointer active:scale-90 transition-transform ${getRankAvatarClass(authorPoints)}`}
                          onClick={() => openProfile(msg.authorName, msg.authorPhotoURL, msg.authorId)}
                        >
                          {msg.authorPhotoURL ? <img src={msg.authorPhotoURL} alt={msg.authorName} className="w-full h-full object-cover" /> : msg.authorName[0]}
                        </div>
                      )}
                      {isMine && (
                        <div
                          className={`w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 mt-1 cursor-pointer active:scale-90 transition-transform ${getRankAvatarClass(authorPoints)}`}
                          onClick={() => openProfile(user?.displayName ?? '나', user?.photoURL ?? undefined, user?.uid)}
                        >
                          {user?.photoURL ? <img src={user.photoURL} alt="나" className="w-full h-full object-cover" /> : (user?.displayName ?? '?')[0]}
                        </div>
                      )}
                      <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                        {!isMine && (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="text-xs text-gray-400">{authorLabel(msg.authorName, msg.authorId, authorPoints)}</span>
                            {authorRank
                              ? <RankBadge rank={authorRank} />
                              : <RankBadge rank={{ rankName: '이병', points: 0 }} />}
                          </div>
                        )}
                        {isMine && memberRanks[user?.uid ?? ''] && (
                          <RankBadge rank={memberRanks[user!.uid]} />
                        )}
                        <div className={`flex items-end gap-1.5 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          {isMine && unreadByOthers > 0 && (
                            <span className="text-[11px] font-bold text-violet-400 dark:text-violet-300 mb-2 shrink-0 tabular-nums">
                              {unreadByOthers}
                            </span>
                          )}
                          <div
                            className={`relative cursor-pointer select-none max-w-full ${
                              msg.imageURL && !msg.replyTo && !msg.text
                                ? 'rounded-2xl overflow-hidden'
                                : `text-sm px-3.5 py-2.5 ${getRankBubbleClass(authorPoints, isMine)}`
                            }`}
                            onContextMenu={(e) => { e.preventDefault(); setReactionTarget(reactionTarget === msg.id ? null : msg.id) }}
                            onTouchStart={() => {
                              const t = setTimeout(() => setReactionTarget(reactionTarget === msg.id ? null : msg.id), 500)
                              const cancel = () => clearTimeout(t)
                              window.addEventListener('touchend', cancel, { once: true })
                              window.addEventListener('touchmove', cancel, { once: true })
                            }}
                          >
                            {msg.replyTo && renderReplyQuote(msg.replyTo, isMine)}
                            {msg.text && (
                              <p className="break-words whitespace-pre-wrap">
                                {showSearch && searchQuery.trim()
                                  ? highlightText(msg.text, searchQuery)
                                  : renderTextWithMentions(msg.text, !!user?.uid && msg.mentions?.includes(user.uid))}
                              </p>
                            )}
                            {msg.imageURL && (
                              <img
                                src={msg.imageURL}
                                alt="사진"
                                onClick={(e) => { e.stopPropagation(); setViewingPhoto(msg.imageURL!) }}
                                className={`max-w-[220px] max-h-[280px] object-cover cursor-pointer ${msg.replyTo || msg.text ? 'mt-1 rounded-xl' : 'rounded-2xl'}`}
                              />
                            )}
                            {msg.audioURL && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`flex items-center gap-2 ${msg.replyTo || msg.text ? 'mt-1' : ''}`}
                              >
                                <audio
                                  controls
                                  preload="metadata"
                                  src={msg.audioURL}
                                  style={{ width: 220, height: 32, accentColor: 'var(--brand)' }}
                                />
                                {msg.audioDuration != null && (
                                  <span className={`text-[10px] shrink-0 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
                                    {formatRecordingTime(msg.audioDuration)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 리액션 팝업 */}
                        {reactionTarget === msg.id && (
                          <div className={`flex flex-col gap-1.5 ${isMine ? 'items-end mr-1' : 'items-start ml-1'}`}>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => startReply(msg)}
                                className="flex items-center gap-1.5 bg-white dark:bg-[#222] border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 shadow-xl active:scale-95 transition-all"
                              >
                                ↩ 답장
                              </button>
                              {!isMine && canMute(getMemberPoints(user?.uid ?? ''), authorPoints) && (
                                <button
                                  onClick={() => handleMute(msg.authorId, msg.authorName)}
                                  className="flex items-center gap-1.5 bg-white dark:bg-[#222] border border-rose-100 dark:border-rose-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 dark:text-rose-400 shadow-xl active:scale-95 transition-all"
                                >
                                  🤐 벙어리
                                </button>
                              )}
                              {!isMine && (
                                <button
                                  onClick={() => handleSalute(msg.authorId, msg.authorName)}
                                  className="flex items-center gap-1.5 bg-white dark:bg-[#222] border border-emerald-100 dark:border-emerald-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 shadow-xl active:scale-95 transition-all"
                                >
                                  🫡 경례
                                </button>
                              )}
                              {isMine && (
                                <button
                                  onClick={() => deleteMessage(msg)}
                                  className="flex items-center gap-1.5 bg-white dark:bg-[#222] border border-red-100 dark:border-red-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-400 shadow-xl active:scale-95 transition-all"
                                >
                                  🗑️ 삭제
                                </button>
                              )}
                            </div>
                            <div className="flex gap-1 bg-white dark:bg-[#222] border border-gray-100 dark:border-white/10 rounded-2xl px-2 py-1.5 shadow-xl">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                  className="text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 active:scale-90 transition-all"
                                >{emoji}</button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 달린 리액션 표시 */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex flex-wrap gap-1 ${isMine ? 'justify-end mr-1' : 'ml-1'}`}>
                            {Object.entries(msg.reactions)
                              .filter(([, uids]) => uids.length > 0)
                              .map(([emoji, uids]) => (
                                <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all active:scale-95 ${
                                    user && uids.includes(user.uid)
                                      ? 'bg-violet-100 dark:bg-violet-500/20 border-violet-300 dark:border-violet-500/40 text-violet-700 dark:text-violet-300'
                                      : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="font-semibold">{uids.length}</span>
                                </button>
                              ))}
                          </div>
                        )}

                        <span className="text-xs text-gray-300 dark:text-gray-600 px-1">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          </>
        )}

        {activeTab === 'gallery' && (
          <div className="flex-1 overflow-y-auto p-4">
            <PhotoGallery messages={messages} onPhotoClick={setViewingPhoto} />
          </div>
        )}

        {activeTab === 'mood' && roomId && <div className="flex-1 overflow-y-auto p-4"><MoodBoard roomId={roomId} /></div>}
        {activeTab === 'music' && roomId && <div className="flex-1 overflow-y-auto p-4"><MusicBoard roomId={roomId} /></div>}
        {activeTab === 'schedule' && roomId && <div className="flex-1 overflow-y-auto p-4"><ScheduleCalendar roomId={roomId} /></div>}
        {activeTab === 'more' && (
          <RoomMorePanel
            room={room}
            dark={dark}
            isJoined={!!isJoined}
            changingPhoto={changingPhoto}
            memberRanks={memberRanks}
            memberProfiles={memberProfiles}
            viewerPoints={myPoints}
            onSelectTab={handleMoreSubTab}
            onInvite={() => setShowInvite(true)}
            onRename={openRename}
            onChangePhoto={() => roomPhotoInputRef.current?.click()}
            onToggleDark={toggleDark}
            onLeave={() => setShowLeave(true)}
            onEnableNotifications={enableNotifications}
            notificationsEnabled={notificationsEnabled}
            onViewProfile={(name, photoURL, userId) => openProfile(name, photoURL, userId)}
          />
        )}
        {activeTab === 'mission' && roomId && <div className="flex-1 overflow-y-auto p-4"><DailyMission roomId={roomId} /></div>}
        {/* 위치는 탭 전환 시에도 계속 추적하기 위해 숨김 처리 방식 사용 */}
        {roomId && <div className={`flex-1 overflow-y-auto p-4 ${activeTab !== 'location' ? 'hidden' : ''}`}><LocationMap roomId={roomId} visible={activeTab === 'location'} /></div>}
        {activeTab === 'stats' && roomId && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <RankBoard roomId={roomId} />
            <RoomStats roomId={roomId} />
          </div>
        )}
      </div>
      )}

      {isJoined && (
        <div className="room-bottom-dock shrink-0">
          {activeTab === 'chat' && (
            <>
              <ChatFeatureBar
                onPoll={() => setFeatureModal('poll')}
                onSchedule={() => setFeatureModal('schedule')}
              />
              {typingUsers.length > 0 && (
                <div className="px-4 pt-2 text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {typingUsers.length === 1
                    ? `${honorific(typingUsers[0].userName, getMemberPoints(typingUsers[0].userId))}이 입력 중...`
                    : `${typingUsers.map((t) => honorific(t.userName, getMemberPoints(t.userId))).join(', ')}이 입력 중...`}
                </div>
              )}
              {replyTarget && (
                <div className="px-4 pt-2 pb-1 flex items-start gap-2 border-b border-[var(--border)]">
                  <div className="flex-1 min-w-0 border-l-2 border-[var(--brand)] pl-2">
                    <p className="text-[11px] font-semibold text-[var(--brand)]">
                      {honorific(replyTarget.authorName, getMemberPoints(replyTarget.authorId))}에게 답장
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {getReplyPreview(replyTarget)}
                    </p>
                  </div>
                  <button type="button" onClick={() => setReplyTarget(null)} className="icon-btn text-lg">✕</button>
                </div>
              )}
              {isMuted && (
                <div className="px-4 py-2 text-xs text-center bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-b border-rose-100 dark:border-rose-500/20">
                  {myMute?.byUserName} {myMute?.byRankName}님의 명령 — 벙어리 {muteRemainingSec}초 🤐
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-center gap-2 px-3 py-2">
                {isRecording ? (
                  <>
                    <div className="flex-1 flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 rounded-xl px-3.5 py-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {formatRecordingTime(recordingSeconds)}
                      </span>
                      <span className="text-xs text-rose-400">녹음 중...</span>
                    </div>
                    <button type="button" onClick={() => finishRecording(false)}
                      className="icon-btn shrink-0 text-lg" aria-label="녹음 취소"
                    >🗑️</button>
                    <button type="button" onClick={() => finishRecording(true)}
                      className="w-10 h-10 rounded-xl bg-[var(--brand)] active:scale-90 flex items-center justify-center text-white shrink-0 transition-all"
                      aria-label="음성 메시지 보내기"
                    >✓</button>
                  </>
                ) : (
                  <>
                    <label className={`icon-btn shrink-0 ${isMuted ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}`}>
                      <span className="text-lg">🖼️</span>
                      <input type="file" accept="image/*" className="hidden" disabled={sending || isMuted}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }}
                      />
                    </label>
                    <input type="text" value={text} onChange={(e) => { setText(e.target.value); handleTyping() }}
                      placeholder={isMuted ? '벙어리 상태…' : '@이름 멘션 · 메시지 보내기...'}
                      disabled={isMuted}
                      className="input-field flex-1 py-2.5 disabled:opacity-50"
                    />
                    {text.trim() ? (
                      <button type="submit" disabled={sending || isMuted}
                        className="w-10 h-10 rounded-xl bg-[var(--brand)] active:scale-90 disabled:opacity-30 flex items-center justify-center text-white shrink-0 transition-all"
                      >{sending ? '⏳' : '→'}</button>
                    ) : (
                      <button type="button" onClick={startRecording} disabled={sending || isMuted}
                        className={`icon-btn shrink-0 text-lg ${isMuted ? 'opacity-40 pointer-events-none' : ''}`}
                        aria-label="음성 메시지 녹음"
                      >🎤</button>
                    )}
                  </>
                )}
              </form>
            </>
          )}
          <RoomBottomNav activeTab={activeTab} onChange={handlePrimaryTab} />
        </div>
      )}

      {showRename && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/10 rounded-3xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">방 이름 변경</h3>
            <form onSubmit={renameRoom} className="space-y-4">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="새 방 이름"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                style={{ fontSize: '16px' }}
                autoFocus
                required
                maxLength={30}
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowRename(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">취소</button>
                <button type="submit" disabled={renaming || !renameValue.trim()} className="flex-1 py-3 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 disabled:opacity-40 text-white font-bold transition-colors">{renaming ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-sheet sheet-enter max-w-sm text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-[var(--text)] mb-2">메시지를 삭제할까요?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">삭제하면 되돌릴 수 없어요.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="btn btn-secondary flex-1">취소</button>
              <button type="button" onClick={confirmDeleteMessage} className="btn flex-1 bg-[var(--danger)] text-white font-bold">삭제</button>
            </div>
          </div>
        </div>
      )}

      {pushDiagnostic && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setPushDiagnostic(null)}
        >
          <div
            className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/10 rounded-3xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-3xl mb-3">🔔</div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3">알림(푸시) 상태</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap break-all text-left">
              {pushDiagnostic}
            </p>
            <button
              type="button"
              onClick={() => setPushDiagnostic(null)}
              className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-bold transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {showLeave && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/10 rounded-3xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🚪</div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">방을 나갈까요?</h3>
            <p className="text-sm text-gray-500 mb-6">나가면 채팅 목록에서 사라져요.<br />초대 링크로 다시 들어올 수 있어요.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeave(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">취소</button>
              <button onClick={leaveRoom} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors">나가기</button>
            </div>
          </div>
        </div>
      )}

      {showInvite && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/10 rounded-3xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🔗</div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">친구 초대하기</h3>
            <p className="text-sm text-gray-500 mb-4">링크 또는 비밀번호를 공유하면<br />이 방에 참여할 수 있어요</p>
            {room.joinCode && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 mb-2 tracking-widest uppercase">방 비밀번호</p>
                <div className="bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-xl px-4 py-3 text-xl font-black text-violet-600 dark:text-violet-400 tracking-[0.25em] mb-2">
                  {room.joinCode}
                </div>
                <button
                  type="button"
                  onClick={copyJoinCode}
                  className="text-sm text-violet-500 dark:text-violet-400 font-semibold hover:underline"
                >
                  {copiedCode ? '비밀번호 복사됨 ✓' : '비밀번호 복사'}
                </button>
              </div>
            )}
            <p className="text-xs text-gray-400 mb-2 tracking-widest uppercase">초대 링크</p>
            <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-gray-400 break-all mb-4">{window.location.href}</div>
            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">닫기</button>
              <button onClick={copyInviteLink} className="flex-1 py-3 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 text-white font-bold transition-colors">{copied ? '링크 복사됨 ✓' : '링크 복사'}</button>
            </div>
          </div>
        </div>
      )}

      <FeatureModals
        showPoll={featureModal === 'poll'}
        showSchedule={featureModal === 'schedule'}
        showBirthday={featureModal === 'birthday'}
        onClose={() => setFeatureModal(null)}
        onCreatePoll={extras.createPoll}
        onSchedule={(t, min) => extras.scheduleMessage(t, Date.now() + min * 60000, parseMentionIds(t, memberProfiles))}
        onSaveBirthday={extras.saveBirthday}
      />

      <input
        ref={roomPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) changeRoomPhoto(file)
        }}
      />
    </div>
  )
}
