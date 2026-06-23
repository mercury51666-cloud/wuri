import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'

interface Room {
  id: string
  name: string
  emoji: string
  memberCount: number
  createdAt: unknown
}

export default function HomePage() {
  const { user } = useAuthState()
  const { dark, toggleDark } = useTheme()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomEmoji, setRoomEmoji] = useState('🏠')
  const [creating, setCreating] = useState(false)

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
    })
    return () => unsubscribe()
  }, [user])

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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      {/* 헤더 */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-10 px-4 py-4 flex items-center justify-between border-b border-violet-100 dark:border-gray-700">
        <div>
          <h1 className="text-xl font-black text-violet-700 dark:text-violet-400">🏠 우리방</h1>
          <p className="text-xs text-gray-400">안녕하세요, {user?.displayName || '친구'}님!</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="text-lg px-1">{dark ? '☀️' : '🌙'}</button>
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* 방 만들기 버튼 */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-violet-200"
        >
          <span className="text-xl">+</span>
          <span>새 방 만들기</span>
        </button>

        {/* 방 목록 */}
        {rooms.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">🏡</div>
            <p className="font-medium">아직 방이 없어요</p>
            <p className="text-sm mt-1">새 방을 만들거나 초대 링크로 참여해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 px-1">내 방 ({rooms.length})</h2>
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => navigate(`/room/${room.id}`)}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow text-left"
              >
                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center text-2xl">
                  {room.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 truncate">{room.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">멤버 {room.memberCount}명</p>
                </div>
                <span className="text-gray-300 text-lg">›</span>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* 방 만들기 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-5">새 방 만들기</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              {/* 이모지 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">방 아이콘</label>
                <div className="flex gap-2 flex-wrap">
                  {emojis.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setRoomEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-colors ${
                        roomEmoji === e ? 'bg-violet-200 ring-2 ring-violet-400' : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              {/* 방 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">방 이름</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="예: 우리 사이 🌙"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="flex-1 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:bg-violet-300 text-white font-bold"
                >
                  {creating ? '만드는 중...' : '만들기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
