import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'
import ProfileModal from '../components/ProfileModal'
import OnboardingModal from '../components/OnboardingModal'
import InstallBanner from '../components/InstallBanner'

interface Room {
  id: string
  name: string
  emoji: string
  memberIds: string[]
  createdAt: unknown
}

export default function HomePage() {
  const { user } = useAuthState()
  const { dark, toggleDark } = useTheme()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomEmoji, setRoomEmoji] = useState('🏠')
  const [creating, setCreating] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('wuri_onboarded')
  })
  const [lastSeenAt, setLastSeenAt] = useState<Record<string, number>>({})
  const [latestMsgAt, setLatestMsgAt] = useState<Record<string, number>>({})

  const emojis = ['🏠', '🌙', '🌈', '🎮', '🎵', '📚', '🍕', '🐾', '🌸', '⭐']

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'rooms'),
      where('memberIds', 'array-contains', user.uid)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Room[]
      setRooms(data)
      setLoadingRooms(false)
    })
    return () => unsubscribe()
  }, [user])

  // 각 방의 최신 메시지 시간 구독
  useEffect(() => {
    if (rooms.length === 0) return
    const unsubs = rooms.map((room) => {
      const q = query(
        collection(db, 'rooms', room.id, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      )
      return onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const ts = snap.docs[0].data().createdAt as { seconds: number } | null
          if (ts) {
            setLatestMsgAt((prev) => ({ ...prev, [room.id]: ts.seconds * 1000 }))
          }
        }
      })
    })
    return () => unsubs.forEach((u) => u())
  }, [rooms])

  // 방 입장 시 lastSeenAt 갱신
  const handleEnterRoom = (roomId: string) => {
    const now = Date.now()
    setLastSeenAt((prev) => ({ ...prev, [roomId]: now }))
    const stored = JSON.parse(localStorage.getItem('wuri_seen') ?? '{}')
    stored[roomId] = now
    localStorage.setItem('wuri_seen', JSON.stringify(stored))
    navigate(`/room/${roomId}`)
  }

  // 초기화 시 localStorage에서 lastSeenAt 불러오기
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('wuri_seen') ?? '{}')
    setLastSeenAt(stored)
  }, [])

  const hasUnread = (roomId: string) => {
    const latest = latestMsgAt[roomId]
    const seen = lastSeenAt[roomId] ?? 0
    return latest && latest > seen
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !roomName.trim()) return
    setCreating(true)
    try {
      const docRef = await addDoc(collection(db, 'rooms'), {
        name: roomName.trim(),
        emoji: roomEmoji,
        memberIds: [user.uid],
        memberCount: 1,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      setShowCreate(false)
      setRoomName('')
      navigate(`/room/${docRef.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page-enter min-h-screen bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50 dark:bg-[#0d0d0d] dark:bg-none">
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showOnboarding && (
        <OnboardingModal onDone={() => {
          localStorage.setItem('wuri_onboarded', '1')
          setShowOnboarding(false)
        }} />
      )}
      <div className="absolute w-72 h-72 rounded-full bg-violet-400 opacity-10 dark:opacity-10 blur-3xl top-0 left-1/2 -translate-x-1/2 pointer-events-none" />

      {/* 헤더 */}
      <header className="safe-top relative sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-violet-100 dark:border-white/10 bg-white/80 dark:bg-[#0d0d0d]/80 backdrop-blur-md">
        <h1 className="text-xl font-black text-violet-700 dark:text-white tracking-tight">
          WU<span className="text-violet-400">RI</span>
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="text-lg px-1">{dark ? '☀️' : '🌙'}</button>
          <button
            onClick={() => setShowProfile(true)}
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-violet-400 dark:border-violet-500 flex-shrink-0 bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center"
          >
            {user?.photoURL
              ? <img src={user.photoURL} alt="프로필" className="w-full h-full object-cover" />
              : <span className="text-white text-xs font-bold">{(user?.displayName ?? user?.email ?? '?').slice(0, 2).toUpperCase()}</span>
            }
          </button>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="relative max-w-md mx-auto pt-4 pb-6 space-y-4">
        <InstallBanner />
        <p className="text-gray-500 text-sm">안녕하세요, <span className="text-violet-500 dark:text-violet-400 font-medium">{user?.displayName || '친구'}</span>님</p>

        <button
          onClick={() => setShowCreate(true)}
          className="w-full bg-violet-500 hover:bg-violet-600 dark:bg-violet-600 dark:hover:bg-violet-500 active:scale-[0.98] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-violet-200 dark:shadow-none"
        >
          <span className="text-xl">+</span>
          <span>새 방 만들기</span>
        </button>

        {loadingRooms ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-full bg-white dark:bg-white/5 border border-violet-100 dark:border-white/10 rounded-2xl p-4 flex items-center gap-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-white/10 rounded-lg w-1/2" />
                  <div className="h-3 bg-gray-100 dark:bg-white/5 rounded-lg w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-3xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center text-4xl mb-1">🏡</div>
            <p className="font-bold text-gray-600 dark:text-gray-300 text-lg">아직 방이 없어요</p>
            <p className="text-sm text-gray-400 dark:text-gray-600 leading-relaxed">
              새 방을 만들거나<br/>초대 링크로 친구 방에 참여해보세요
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 text-violet-500 dark:text-violet-400 text-sm font-semibold underline underline-offset-2 active:opacity-60 transition-opacity"
            >
              방 만들기 →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-600 px-1 tracking-widest uppercase">내 방 ({rooms.length})</h2>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleEnterRoom(room.id)}
                className="w-full bg-white dark:bg-white/5 border border-violet-100 dark:border-white/10 hover:shadow-md dark:hover:bg-white/10 active:scale-[0.98] rounded-2xl p-4 flex items-center gap-4 transition-all text-left shadow-sm"
              >
                <div className="relative w-12 h-12 shrink-0">
                  <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/20 rounded-xl flex items-center justify-center text-2xl border border-violet-200 dark:border-violet-500/20">
                    {room.emoji}
                  </div>
                  {hasUnread(room.id) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-[#0d0d0d]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold truncate ${hasUnread(room.id) ? 'text-gray-900 dark:text-white' : 'text-gray-800 dark:text-white'}`}>{room.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">멤버 {room.memberIds?.length ?? 1}명</p>
                </div>
                {hasUnread(room.id) && (
                  <span className="w-2 h-2 bg-rose-500 rounded-full" />
                )}
                {!hasUnread(room.id) && <span className="text-gray-300 dark:text-gray-600 text-lg">›</span>}
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] border border-violet-100 dark:border-white/10 rounded-3xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-5">새 방 만들기</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2 tracking-widest uppercase">방 아이콘</label>
                <div className="flex gap-2 flex-wrap">
                  {emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setRoomEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-colors ${
                        roomEmoji === e ? 'bg-violet-200 dark:bg-violet-500/30 ring-2 ring-violet-400 dark:ring-violet-500' : 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 tracking-widest uppercase">방 이름</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="예: 우리 사이 🌙"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">취소</button>
                <button type="submit" disabled={creating || !roomName.trim()} className="flex-1 py-3 rounded-xl bg-violet-500 dark:bg-violet-600 hover:bg-violet-600 dark:hover:bg-violet-500 disabled:opacity-40 text-white font-bold transition-colors">{creating ? '만드는 중...' : '만들기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
