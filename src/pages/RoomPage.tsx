import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, collection, query, orderBy,
  onSnapshot, addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'
import { useMessageNotifications } from '../hooks/useNotifications'
import Mascot from '../components/Mascot'
import DailyMission from '../components/DailyMission'
import RoomStats from '../components/RoomStats'
import LocationMap from '../components/LocationMap'
import { useUserProfiles } from '../hooks/useUserProfiles'

interface Reaction {
  [emoji: string]: string[] // emoji -> uid[]
}

interface Message {
  id: string
  text: string
  authorId: string
  authorName: string
  authorPhotoURL?: string
  createdAt: { seconds: number } | null
  reactions?: Reaction
}

interface Room {
  name: string
  emoji: string
  memberIds: string[]
}

type Tab = 'chat' | 'mascot' | 'mission' | 'location' | 'stats'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'chat',     emoji: '💬', label: '채팅' },
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
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showLeave, setShowLeave] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [reactionTarget, setReactionTarget] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const memberProfiles = useUserProfiles(room?.memberIds ?? [])

  const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

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
    return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) { navigate('/'); return }
      setRoom(snap.data() as Room)
    })
  }, [roomId, navigate])

  useEffect(() => {
    if (!roomId) return
    const q = query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)))
    })
  }, [roomId])

  useEffect(() => {
    if (activeTab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTab])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !roomId || !text.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        text: text.trim(),
        authorId: user.uid,
        authorName: user.displayName || '친구',
        authorPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
      })
      setText('')
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
    await updateDoc(doc(db, 'rooms', roomId), { memberIds: arrayRemove(user.uid) })
    navigate('/')
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

  if (!room) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] flex flex-col max-w-md mx-auto animate-pulse">
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
    <div className="page-enter min-h-screen bg-gray-50 dark:bg-[#0d0d0d] flex flex-col max-w-md mx-auto">
      {/* 햄버거 사이드 메뉴 */}
      {showMenu && (
        <div className="fixed inset-0 z-[2000] flex">
          <div className="menu-enter w-64 bg-white dark:bg-[#111] border-r border-gray-100 dark:border-white/10 flex flex-col gap-2 shadow-2xl" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)', paddingBottom: '1.5rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center text-2xl">
                {room.emoji}
              </div>
              <div>
                <p className="font-bold text-gray-800 dark:text-white text-sm">{room.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">멤버 {room.memberIds.length}명</p>
              </div>
            </div>
            {TABS.map((tab) => (
              <button key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowMenu(false) }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors text-left ${
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
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0">
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
            <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-white/10">
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
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white text-sm px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">홈</button>
        </div>
      </header>

      {!isJoined && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/20 px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-700 dark:text-amber-400">아직 이 방의 멤버가 아니에요</p>
          <button onClick={joinRoom} className="text-sm bg-amber-500 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-amber-600 dark:hover:bg-amber-400 transition-colors">참여하기</button>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" onClick={() => setReactionTarget(null)}>
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center text-3xl">💬</div>
                  <p className="font-semibold text-gray-500 dark:text-gray-400">아직 대화가 없어요</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 text-center">첫 메시지로 대화를 시작해보세요!</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMine = msg.authorId === user?.uid
                const prevMsg = idx > 0 ? messages[idx - 1] : null
                const showDateLabel = !prevMsg || (
                  msg.createdAt && prevMsg.createdAt &&
                  new Date(msg.createdAt.seconds * 1000).toDateString() !==
                  new Date(prevMsg.createdAt.seconds * 1000).toDateString()
                )
                return (
                  <div key={msg.id}>
                    {showDateLabel && msg.createdAt && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
                        <span className="text-xs text-gray-400 dark:text-gray-600 font-medium px-2">{formatDateLabel(msg.createdAt)}</span>
                        <div className="flex-1 h-px bg-gray-100 dark:bg-white/10" />
                      </div>
                    )}
                    <div className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isMine && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 mt-1">
                          {msg.authorPhotoURL ? <img src={msg.authorPhotoURL} alt={msg.authorName} className="w-full h-full object-cover" /> : msg.authorName[0]}
                        </div>
                      )}
                      {isMine && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0 mt-1">
                          {user?.photoURL ? <img src={user.photoURL} alt="나" className="w-full h-full object-cover" /> : (user?.displayName ?? '?')[0]}
                        </div>
                      )}
                      <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                        {!isMine && <span className="text-xs text-gray-400 ml-1">{msg.authorName}</span>}
                        <div
                          className={`relative px-4 py-2.5 rounded-2xl text-sm cursor-pointer select-none ${
                            isMine ? 'bg-violet-500 dark:bg-violet-600 text-white rounded-tr-sm'
                                   : 'bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 text-gray-800 dark:text-gray-200 shadow-sm rounded-tl-sm'
                          }`}
                          onContextMenu={(e) => { e.preventDefault(); setReactionTarget(reactionTarget === msg.id ? null : msg.id) }}
                          onTouchStart={() => {
                            const t = setTimeout(() => setReactionTarget(reactionTarget === msg.id ? null : msg.id), 500)
                            const cancel = () => clearTimeout(t)
                            window.addEventListener('touchend', cancel, { once: true })
                            window.addEventListener('touchmove', cancel, { once: true })
                          }}
                        >
                          {msg.text}
                        </div>

                        {/* 리액션 팝업 */}
                        {reactionTarget === msg.id && (
                          <div className={`flex gap-1 bg-white dark:bg-[#222] border border-gray-100 dark:border-white/10 rounded-2xl px-2 py-1.5 shadow-xl ${isMine ? 'mr-1' : 'ml-1'}`}>
                            {REACTION_EMOJIS.map((emoji) => (
                              <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                className="text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 active:scale-90 transition-all"
                              >{emoji}</button>
                            ))}
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
            <div className="border-t border-gray-100 dark:border-white/10 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md px-4 py-3">
              <form onSubmit={sendMessage} className="flex items-center gap-2">
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="메시지 보내기..."
                  className="flex-1 bg-gray-100 dark:bg-white/10 border border-transparent dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                />
                <button type="submit" disabled={sending || !text.trim()}
                  className="w-10 h-10 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 active:scale-90 disabled:opacity-30 flex items-center justify-center text-white shrink-0 transition-all"
                >→</button>
              </form>
            </div>
          </>
        )}

        {activeTab === 'mascot' && roomId && <div className="flex-1 overflow-y-auto p-4"><Mascot roomId={roomId} totalMessages={messages.length} /></div>}
        {activeTab === 'mission' && roomId && <div className="flex-1 overflow-y-auto p-4"><DailyMission roomId={roomId} /></div>}
        {activeTab === 'location' && roomId && <div className="flex-1 overflow-y-auto p-4"><LocationMap roomId={roomId} /></div>}
        {activeTab === 'stats' && roomId && <div className="flex-1 overflow-y-auto p-4"><RoomStats roomId={roomId} /></div>}
      </div>

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
