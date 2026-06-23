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
import PhotoFeed from '../components/PhotoFeed'
import PenaltyKick from '../components/games/PenaltyKick'
import BalanceGame from '../components/games/BalanceGame'
import Mascot from '../components/Mascot'
import DailyMission from '../components/DailyMission'
import RoomStats from '../components/RoomStats'
import LocationMap from '../components/LocationMap'

interface Message {
  id: string
  text: string
  authorId: string
  authorName: string
  authorPhotoURL?: string
  createdAt: { seconds: number } | null
}

interface Room {
  name: string
  emoji: string
  memberIds: string[]
}

type Tab = 'chat' | 'photo' | 'game' | 'home'
type GameTab = 'penalty' | 'balance'
type HomeTab = 'mascot' | 'mission' | 'stats' | 'location'

const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'chat',  emoji: '💬', label: '채팅' },
  { id: 'photo', emoji: '📷', label: '사진' },
  { id: 'game',  emoji: '🎮', label: '게임' },
  { id: 'home',  emoji: '✨', label: '우리방' },
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
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('chat')
  const [gameTab, setGameTab] = useState<GameTab>('penalty')
  const [homeTab, setHomeTab] = useState<HomeTab>('mascot')
  const bottomRef = useRef<HTMLDivElement>(null)

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

  if (!room) return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const isJoined = user && room.memberIds.includes(user.uid)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0d0d0d] flex flex-col max-w-md mx-auto">
      {/* 헤더 */}
      <header className="bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 dark:border-white/10 shadow-sm dark:shadow-none">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-white text-xl transition-colors">‹</button>
          <div className="w-9 h-9 bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 rounded-xl flex items-center justify-center text-xl">
            {room.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 dark:text-white truncate">{room.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">멤버 {room.memberIds.length}명</p>
          </div>
          <button onClick={toggleDark} className="text-lg px-1">{dark ? '☀️' : '🌙'}</button>
          <button onClick={() => setShowInvite(true)} className="text-xs bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 font-medium px-3 py-1.5 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-500/30 transition-colors">초대</button>
          {isJoined && (
            <button onClick={() => setShowLeave(true)} className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">나가기</button>
          )}
        </div>
        <div className="flex border-t border-gray-100 dark:border-white/10">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                activeTab === tab.id ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
              }`}
            >
              <span>{tab.emoji}</span><span>{tab.label}</span>
            </button>
          ))}
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
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-12 text-gray-300 dark:text-gray-600">
                  <div className="text-4xl mb-2">💬</div>
                  <p className="text-sm">첫 메시지를 보내보세요!</p>
                </div>
              )}
              {messages.map((msg) => {
                const isMine = msg.authorId === user?.uid
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
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
                      <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                        isMine ? 'bg-violet-500 dark:bg-violet-600 text-white rounded-tr-sm'
                               : 'bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 text-gray-800 dark:text-gray-200 shadow-sm rounded-tl-sm'
                      }`}>{msg.text}</div>
                      <span className="text-xs text-gray-300 dark:text-gray-600 px-1">{formatTime(msg.createdAt)}</span>
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
                  className="w-10 h-10 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 disabled:opacity-30 flex items-center justify-center text-white shrink-0 transition-colors"
                >→</button>
              </form>
            </div>
          </>
        )}

        {activeTab === 'photo' && roomId && <div className="flex-1 overflow-y-auto"><PhotoFeed roomId={roomId} /></div>}

        {activeTab === 'game' && roomId && (
          <div className="flex-1 overflow-y-auto">
            <div className="flex bg-white dark:bg-[#0d0d0d] border-b border-gray-100 dark:border-white/10">
              <button onClick={() => setGameTab('penalty')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1 transition-colors ${gameTab === 'penalty' ? 'text-green-600 dark:text-green-400 border-b-2 border-green-500' : 'text-gray-400 dark:text-gray-600'}`}>⚽ 페널티킥</button>
              <button onClick={() => setGameTab('balance')} className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-1 transition-colors ${gameTab === 'balance' ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 dark:text-gray-600'}`}>⚖️ 밸런스게임</button>
            </div>
            {gameTab === 'penalty' && <PenaltyKick roomId={roomId} />}
            {gameTab === 'balance' && <BalanceGame roomId={roomId} />}
          </div>
        )}

        {activeTab === 'home' && roomId && (
          <div className="flex-1 overflow-y-auto">
            <div className="flex bg-white dark:bg-[#0d0d0d] border-b border-gray-100 dark:border-white/10">
              {([
                { id: 'mascot' as HomeTab, label: '🐾 마스코트' },
                { id: 'mission' as HomeTab, label: '🎯 미션' },
                { id: 'stats' as HomeTab, label: '📊 통계' },
                { id: 'location' as HomeTab, label: '📍 위치' },
              ]).map((t) => (
                <button key={t.id} onClick={() => setHomeTab(t.id)}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors ${homeTab === t.id ? 'text-violet-600 dark:text-violet-400 border-b-2 border-violet-500' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'}`}
                >{t.label}</button>
              ))}
            </div>
            <div className="p-4">
              {homeTab === 'mascot' && <Mascot roomId={roomId} totalMessages={messages.length} />}
              {homeTab === 'mission' && <DailyMission roomId={roomId} />}
              {homeTab === 'stats' && <RoomStats roomId={roomId} />}
              {homeTab === 'location' && <LocationMap roomId={roomId} />}
            </div>
          </div>
        )}
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
