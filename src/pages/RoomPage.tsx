import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, collection, query, orderBy,
  onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, setDoc, deleteDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'
import { useMessageNotifications } from '../hooks/useNotifications'
import { countUnreadByOthers } from '../hooks/useReadStatus'
import Mascot from '../components/Mascot'
import DailyMission from '../components/DailyMission'
import RoomStats from '../components/RoomStats'
import LocationMap from '../components/LocationMap'
import MoodBoard from '../components/MoodBoard'
import PhotoGallery from '../components/PhotoGallery'
import { useUserProfiles } from '../hooks/useUserProfiles'
interface Reaction {
  [emoji: string]: string[] // emoji -> uid[]
}

interface ReplyTo {
  id: string
  authorName: string
  text: string
  imageURL?: string
}

interface Message {
  id: string
  text: string
  imageURL?: string
  authorId: string
  authorName: string
  authorPhotoURL?: string
  createdAt: { seconds: number } | null
  reactions?: Reaction
  replyTo?: ReplyTo
}

interface Room {
  name: string
  emoji: string
  memberIds: string[]
  pinnedMessageId?: string | null
}

type Tab = 'chat' | 'gallery' | 'mascot' | 'mission' | 'location' | 'stats' | 'mood'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'chat',     emoji: '💬', label: '채팅' },
  { id: 'gallery',  emoji: '🖼️', label: '사진' },
  { id: 'mood',     emoji: '😊', label: '기분' },
  { id: 'mascot',   emoji: '🐾', label: '마스코트' },
  { id: 'mission',  emoji: '🎯', label: '미션' },
  { id: 'location', emoji: '📍', label: '위치' },
  { id: 'stats',    emoji: '📊', label: '통계' },
]

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const { user } = useAuthState()
  const { dark, toggleDark } = useTheme()
  const navigate = useNavigate()

  const [room, setRoom] = useState<Room | null>(null)
  const [roomError, setRoomError] = useState('')
  const [joining, setJoining] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const [replyTarget, setReplyTarget] = useState<Message | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIdx, setSearchIdx] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [viewingProfile, setViewingProfile] = useState<{ name: string; photoURL?: string } | null>(null)
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null)
  const [memberReadAt, setMemberReadAt] = useState<Record<string, number>>({})
  const [typingRaw, setTypingRaw] = useState<Record<string, { userName: string; updatedAt: number }>>({})
  const [, setTypingTick] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const memberProfiles = useUserProfiles(room?.memberIds ?? [])

  const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

  const getReplyPreview = (msg: Pick<Message, 'text' | 'imageURL'>) => {
    if (msg.imageURL) return '📷 사진'
    const t = msg.text.trim()
    return t.length > 60 ? `${t.slice(0, 60)}…` : t
  }

  const startReply = (msg: Message) => {
    setReplyTarget(msg)
    setReactionTarget(null)
  }

  const deleteMessage = async (msg: Message) => {
    if (!user || !roomId || msg.authorId !== user.uid) return
    if (!confirm('메시지를 삭제할까요?')) return
    await deleteDoc(doc(db, 'rooms', roomId, 'messages', msg.id))
    if (room?.pinnedMessageId === msg.id) {
      await updateDoc(doc(db, 'rooms', roomId), { pinnedMessageId: null })
    }
    setReactionTarget(null)
  }

  const pinMessage = async (msg: Message) => {
    if (!roomId) return
    await updateDoc(doc(db, 'rooms', roomId), { pinnedMessageId: msg.id })
    setReactionTarget(null)
  }

  const unpinMessage = async () => {
    if (!roomId) return
    await updateDoc(doc(db, 'rooms', roomId), { pinnedMessageId: null })
  }

  const pinnedMessage = useMemo(() => {
    if (!room?.pinnedMessageId) return null
    return messages.find((m) => m.id === room.pinnedMessageId) ?? null
  }, [room?.pinnedMessageId, messages])

  const scrollToMessage = (msgId: string) => {
    messageRefs.current.get(msgId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightId(msgId)
    setTimeout(() => setHighlightId(null), 1800)
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

  const renderReplyQuote = (reply: ReplyTo, isMine: boolean) => (
    <div className={`rounded-lg px-2.5 py-2 mb-2 ${isMine ? 'bg-black/15' : 'bg-gray-100 dark:bg-white/10'}`}>
      <p className={`text-[11px] font-semibold leading-tight mb-0.5 ${isMine ? 'text-white/90' : 'text-violet-500 dark:text-violet-400'}`}>
        {reply.authorName}
      </p>
      <p className={`text-xs leading-snug line-clamp-2 ${isMine ? 'text-white/75' : 'text-gray-500 dark:text-gray-400'}`}>
        {reply.imageURL ? '📷 사진' : reply.text}
      </p>
    </div>
  )

  const toggleReaction = async (msgId: string, emoji: string) => {
    if (!user || !roomId) return
    const msgRef = doc(db, 'rooms', roomId, 'messages', msgId)
    const msg = messages.find((m) => m.id === msgId)
    const current = msg?.reactions?.[emoji] ?? []
    const hasReacted = current.includes(user.uid)
    await updateDoc(msgRef, {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(user.uid) : arrayUnion(user.uid),
    })
    setReactionTarget(null)
  }

  useMessageNotifications(messages, user?.uid, room?.name ?? '우리방')

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

  const autoJoinAttempted = useRef(false)
  const skipAutoJoinRef = useRef(false)

  useEffect(() => {
    autoJoinAttempted.current = false
    skipAutoJoinRef.current = false
  }, [roomId])

  // 초대 링크로 들어온 경우 자동 참여
  useEffect(() => {
    if (!user || !roomId || !room || autoJoinAttempted.current || skipAutoJoinRef.current) return
    if (room.memberIds.includes(user.uid)) {
      autoJoinAttempted.current = true
      return
    }
    autoJoinAttempted.current = true
    setJoining(true)
    updateDoc(doc(db, 'rooms', roomId), { memberIds: arrayUnion(user.uid) })
      .catch(() => {
        autoJoinAttempted.current = false
        setRoomError('방 참여에 실패했어요. 아래 버튼을 눌러 다시 시도해주세요.')
      })
      .finally(() => setJoining(false))
  }, [user, roomId, room])

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
    if (!user || !roomId || !text.trim()) return
    setSending(true)
    const msgText = text.trim()
    try {
      const payload: Record<string, unknown> = {
        text: msgText,
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
        }
      }
      await addDoc(collection(db, 'rooms', roomId, 'messages'), payload)
      setText('')
      setReplyTarget(null)
      clearTyping()
    } finally {
      setSending(false)
    }
  }

  const sendImage = async (file: File) => {
    if (!user || !roomId) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST', body: formData,
      })
      const data = await res.json()
      const payload: Record<string, unknown> = {
        text: '',
        imageURL: data.secure_url,
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
        }
      }
      await addDoc(collection(db, 'rooms', roomId, 'messages'), payload)
      setReplyTarget(null)
    } finally {
      setSending(false)
    }
  }

  const joinRoom = async () => {
    if (!user || !roomId) return
    await updateDoc(doc(db, 'rooms', roomId), { memberIds: arrayUnion(user.uid) })
  }

  const leaveRoom = async () => {
    if (!user || !roomId) return
    skipAutoJoinRef.current = true
    setShowLeave(false)
    try {
      await updateDoc(doc(db, 'rooms', roomId), { memberIds: arrayRemove(user.uid) })
      navigate('/')
    } catch {
      skipAutoJoinRef.current = false
      alert('방 나가기에 실패했어요. 다시 시도해주세요.')
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openRename = () => {
    setRenameValue(room?.name ?? '')
    setShowRename(true)
    setShowMenu(false)
  }

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
    <div className="h-full bg-gray-50 dark:bg-[#0d0d0d] flex flex-col max-w-md mx-auto items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">🚪</div>
      <p className="font-bold text-gray-800 dark:text-white mb-2">{roomError}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">링크가 올바른지 확인하거나<br />방장에게 다시 초대를 요청해주세요.</p>
      <button onClick={() => navigate('/')} className="px-6 py-3 rounded-xl bg-violet-500 text-white font-bold">홈으로</button>
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
    <div className="page-enter h-full bg-gray-50 dark:bg-[#0d0d0d] flex flex-col max-w-md mx-auto overflow-hidden">
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
          <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-violet-200">
              {viewingProfile.photoURL
                ? <img src={viewingProfile.photoURL} alt={viewingProfile.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-5xl font-black text-violet-600">{viewingProfile.name[0]}</div>
              }
            </div>
            <p className="text-white text-xl font-bold">{viewingProfile.name}</p>
            <button onClick={() => setViewingProfile(null)} className="text-white/60 text-sm mt-2">닫기</button>
          </div>
        </div>
      )}

      {/* 햄버거 사이드 메뉴 */}
      {showMenu && (
        <div className="fixed inset-0 z-[2000] flex">
          <div
            className="menu-enter w-64 h-full bg-white dark:bg-[#111] border-r border-gray-100 dark:border-white/10 flex flex-col shadow-2xl"
            style={{
              paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
              paddingLeft: '1rem',
              paddingRight: '1rem',
            }}
          >
            <div className="flex items-center gap-3 mb-4 px-2 shrink-0">
              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center text-2xl">
                {room.emoji}
              </div>
              <div>
                <p className="font-bold text-gray-800 dark:text-white text-sm">{room.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">멤버 {room.memberIds.length}명</p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 -mx-1 px-1">
              {TABS.map((tab) => (
                <button key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setShowMenu(false) }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="text-lg">{tab.emoji}</span>
                  <span>{tab.label}</span>
                </button>
              ))}

              {/* 멤버 목록 */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 px-2 mb-2 tracking-widest uppercase">멤버</p>
                <div className="space-y-1">
                  {room.memberIds.map((uid) => {
                    const profile = memberProfiles[uid]
                    const isMe = uid === user?.uid
                    return (
                      <div key={uid} className="flex items-center gap-3 px-2 py-2 rounded-xl">
                        <div
                          className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 cursor-pointer active:scale-90 transition-transform"
                          onClick={() => profile && setViewingProfile({ name: profile.displayName, photoURL: profile.photoURL ?? undefined })}
                        >
                          {profile?.photoURL
                            ? <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                            : (profile?.displayName ?? '?')[0]
                          }
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                          {profile?.displayName ?? '불러오는 중...'}
                          {isMe && <span className="text-xs text-violet-400 ml-1">(나)</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-2 pt-4 mt-2 border-t border-gray-100 dark:border-white/10">
              {isJoined && (
                <button onClick={openRename} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                  <span>✏️</span><span>방 이름 변경</span>
                </button>
              )}
              <button onClick={() => { setShowInvite(true); setShowMenu(false) }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <span>🔗</span><span>친구 초대</span>
              </button>
              <button onClick={toggleDark} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                <span>{dark ? '☀️' : '🌙'}</span><span>{dark ? '라이트 모드' : '다크 모드'}</span>
              </button>
              {isJoined && (
                <button onClick={() => { setShowLeave(true); setShowMenu(false) }} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                  <span>🚪</span><span>방 나가기</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setShowMenu(false)} />
        </div>
      )}

      {/* 헤더 */}
      <header className="safe-top bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 dark:border-white/10 shadow-sm dark:shadow-none">
        {showSearch && activeTab === 'chat' ? (
          <div className="px-3 py-2.5 flex items-center gap-2">
            <input
              autoFocus
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="메시지 검색..."
              className="flex-1 min-w-0 bg-gray-100 dark:bg-white/10 rounded-xl px-3 py-2 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
              style={{ fontSize: '16px' }}
            />
            {searchResults.length > 0 && (
              <span className="text-[11px] text-gray-400 shrink-0 tabular-nums">
                {searchIdx + 1}/{searchResults.length}
              </span>
            )}
            <button
              type="button"
              disabled={searchResults.length === 0}
              onClick={() => setSearchIdx((i) => (i - 1 + searchResults.length) % searchResults.length)}
              className="w-8 h-8 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={searchResults.length === 0}
              onClick={() => setSearchIdx((i) => (i + 1) % searchResults.length)}
              className="w-8 h-8 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={closeSearch}
              className="text-sm text-violet-500 dark:text-violet-400 font-medium px-2 shrink-0"
            >
              취소
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setShowMenu(true)} className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors shrink-0">
              <span className="w-5 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full" />
              <span className="w-5 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full" />
              <span className="w-5 h-0.5 bg-gray-600 dark:bg-gray-400 rounded-full" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800 dark:text-white truncate">
                {TABS.find(t => t.id === activeTab)?.emoji} {TABS.find(t => t.id === activeTab)?.label}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{room.name}</p>
            </div>
            {activeTab === 'chat' && (
              <button
                onClick={() => setShowSearch(true)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white text-lg px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                🔍
              </button>
            )}
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">홈</button>
          </div>
        )}
      </header>

      {!isJoined && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {joining ? '방에 참여하는 중...' : '아직 이 방의 멤버가 아니에요'}
          </p>
          {!joining && (
            <button onClick={joinRoom} className="text-sm bg-amber-500 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-amber-600 dark:hover:bg-amber-400 transition-colors">참여하기</button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chat' && (
          <>
            {pinnedMessage && (
              <div className="mx-4 mt-3 mb-0 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl px-3 py-2.5 flex items-start gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollToMessage(pinnedMessage.id)}
                  className="flex-1 min-w-0 text-left active:opacity-70 transition-opacity"
                >
                  <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-0.5">📌 공지</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                    <span className="font-semibold">{pinnedMessage.authorName}</span>
                    {' · '}
                    {pinnedMessage.imageURL && !pinnedMessage.text
                      ? '📷 사진'
                      : pinnedMessage.text}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={unpinMessage}
                  className="text-xs text-amber-600/70 dark:text-amber-400/70 px-2 py-1 shrink-0 active:scale-95"
                >
                  해제
                </button>
              </div>
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
                const isMine = msg.authorId === user?.uid
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
                          className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 mt-1 cursor-pointer active:scale-90 transition-transform"
                          onClick={() => setViewingProfile({ name: msg.authorName, photoURL: msg.authorPhotoURL })}
                        >
                          {msg.authorPhotoURL ? <img src={msg.authorPhotoURL} alt={msg.authorName} className="w-full h-full object-cover" /> : msg.authorName[0]}
                        </div>
                      )}
                      {isMine && (
                        <div
                          className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 mt-1 cursor-pointer active:scale-90 transition-transform"
                          onClick={() => setViewingProfile({ name: user?.displayName ?? '나', photoURL: user?.photoURL ?? undefined })}
                        >
                          {user?.photoURL ? <img src={user.photoURL} alt="나" className="w-full h-full object-cover" /> : (user?.displayName ?? '?')[0]}
                        </div>
                      )}
                      <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                        {!isMine && <span className="text-xs text-gray-400 ml-1">{msg.authorName}</span>}
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
                                : `rounded-2xl text-sm px-3 py-2.5 ${isMine ? 'bg-violet-500 dark:bg-violet-600 text-white rounded-tr-sm' : 'bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 text-gray-800 dark:text-gray-200 shadow-sm rounded-tl-sm'}`
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
                                  : msg.text}
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
                              <button
                                onClick={() => pinMessage(msg)}
                                className="flex items-center gap-1.5 bg-white dark:bg-[#222] border border-amber-100 dark:border-amber-500/20 rounded-xl px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 shadow-xl active:scale-95 transition-all"
                              >
                                📌 공지
                              </button>
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
            <div className="border-t border-gray-100 dark:border-white/10 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md safe-bottom">
              {typingUsers.length > 0 && (
                <div className="px-4 pt-2 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {typingUsers.length === 1
                    ? `${typingUsers[0].userName}님이 입력 중...`
                    : `${typingUsers.map((t) => t.userName).join(', ')}님이 입력 중...`}
                </div>
              )}
              {replyTarget && (
                <div className="px-4 pt-3 flex items-start gap-2 border-b border-gray-100 dark:border-white/10">
                  <div className="flex-1 min-w-0 border-l-2 border-violet-400 pl-2">
                    <p className="text-[11px] font-semibold text-violet-500 dark:text-violet-400">
                      {replyTarget.authorName}에게 답장
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getReplyPreview(replyTarget)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTarget(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg px-1 active:scale-90 transition-all"
                  >
                    ✕
                  </button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-center gap-2 px-4 py-3">
                <label className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 active:scale-90 flex items-center justify-center shrink-0 cursor-pointer transition-all">
                  <span className="text-lg">🖼️</span>
                  <input type="file" accept="image/*" className="hidden" disabled={sending}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = '' }}
                  />
                </label>
                <input type="text" value={text} onChange={(e) => { setText(e.target.value); handleTyping() }} placeholder="메시지 보내기..."
                  className="flex-1 bg-gray-100 dark:bg-white/10 border border-transparent dark:border-white/10 rounded-xl px-4 py-2.5 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                  style={{ fontSize: '16px' }}
                />
                <button type="submit" disabled={sending || !text.trim()}
                  className="w-10 h-10 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 active:scale-90 disabled:opacity-30 flex items-center justify-center text-white shrink-0 transition-all"
                >{sending ? '⏳' : '→'}</button>
              </form>
            </div>
          </>
        )}

        {activeTab === 'gallery' && (
          <div className="flex-1 overflow-y-auto p-4">
            <PhotoGallery messages={messages} onPhotoClick={setViewingPhoto} />
          </div>
        )}

        {activeTab === 'mood' && roomId && <div className="flex-1 overflow-y-auto p-4"><MoodBoard roomId={roomId} /></div>}
        {activeTab === 'mascot' && roomId && <div className="flex-1 overflow-y-auto p-4"><Mascot roomId={roomId} totalMessages={messages.length} /></div>}
        {activeTab === 'mission' && roomId && <div className="flex-1 overflow-y-auto p-4"><DailyMission roomId={roomId} /></div>}
        {/* 위치는 탭 전환 시에도 계속 추적하기 위해 숨김 처리 방식 사용 */}
        {roomId && <div className={`flex-1 overflow-y-auto p-4 ${activeTab !== 'location' ? 'hidden' : ''}`}><LocationMap roomId={roomId} visible={activeTab === 'location'} /></div>}
        {activeTab === 'stats' && roomId && <div className="flex-1 overflow-y-auto p-4"><RoomStats roomId={roomId} /></div>}
      </div>

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
            <p className="text-sm text-gray-500 mb-5">아래 링크를 친구에게 공유하면<br />이 방에 참여할 수 있어요</p>
            <div className="bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-xs text-gray-600 dark:text-gray-400 break-all mb-4">{window.location.href}</div>
            <div className="flex gap-3">
              <button onClick={() => setShowInvite(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">닫기</button>
              <button onClick={copyInviteLink} className="flex-1 py-3 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 text-white font-bold transition-colors">{copied ? '복사됨 ✓' : '링크 복사'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
