import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  doc,
  getDocs,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'
import { countUnreadMessages, toMs } from '../hooks/useReadStatus'
import ProfileModal from '../components/ProfileModal'
import OnboardingModal from '../components/OnboardingModal'
import InstallBanner from '../components/InstallBanner'
import RoomAvatar from '../components/RoomAvatar'
import { uploadToCloudinary } from '../utils/cloudinary'
import { generateJoinCode, normalizeJoinCode, isValidJoinCodeFormat } from '../utils/joinCode'
import { useToast } from '../contexts/ToastContext'
import { postJoinWelcome } from '../utils/rankEvents'
import { Plus, KeyRound, ChevronRight, Moon, Sun, LogOut } from 'lucide-react'

interface Room {
  id: string
  name: string
  emoji?: string
  photoURL?: string
  memberIds: string[]
  createdAt: unknown
}

export default function HomePage() {
  const { user } = useAuthState()
  const { dark, toggleDark } = useTheme()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomPhotoFile, setRoomPhotoFile] = useState<File | null>(null)
  const [roomPhotoPreview, setRoomPhotoPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showJoinByCode, setShowJoinByCode] = useState(false)
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [joinCodeError, setJoinCodeError] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)
  const [roomJoinCode, setRoomJoinCode] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('wuri_onboarded')
  })
  const [myLastRead, setMyLastRead] = useState<Record<string, number>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  /** 방별 최근 메시지 캐시 — 읽음 시각이 바뀌어도 Firestore 재구독하지 않도록 분리 */
  const [recentByRoom, setRecentByRoom] = useState<Record<string, { authorId: string; createdAt: { seconds: number } | null }[]>>({})

  const resetCreateForm = () => {
    setRoomName('')
    setRoomPhotoFile(null)
    setRoomPhotoPreview(null)
    setRoomJoinCode('')
  }

  const resetJoinForm = () => {
    setJoinCodeInput('')
    setJoinCodeError('')
  }

  const handlePhotoSelect = (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('이미지 파일만 선택할 수 있어요')
      return
    }
    setRoomPhotoFile(file)
    setRoomPhotoPreview(URL.createObjectURL(file))
  }

  const clearRoomPhoto = () => {
    setRoomPhotoFile(null)
    if (roomPhotoPreview) URL.revokeObjectURL(roomPhotoPreview)
    setRoomPhotoPreview(null)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

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
      data.sort((a, b) => toMs(b.createdAt as { seconds: number }) - toMs(a.createdAt as { seconds: number }))
      setRooms(data)
      setLoadingRooms(false)
    })
    return () => unsubscribe()
  }, [user])

  // 방 목록 객체 참조가 바뀔 때마다 재구독하지 않도록 id 목록만 의존
  const roomIdsKey = rooms.map((r) => r.id).sort().join(',')

  // 각 방의 내 읽음 시각 구독
  useEffect(() => {
    if (!user || !roomIdsKey) return
    const ids = roomIdsKey.split(',')
    const unsubs = ids.map((roomId) =>
      onSnapshot(doc(db, 'rooms', roomId, 'readStatus', user.uid), (snap) => {
        const ts = snap.data()?.lastReadAt as { seconds: number } | undefined
        setMyLastRead((prev) => ({ ...prev, [roomId]: toMs(ts) }))
      }),
    )
    return () => unsubs.forEach((u) => u())
  }, [user, roomIdsKey])

  // 각 방의 최근 메시지만 구독 (읽음 시각 변경 시 재구독하지 않음 → 읽기 낭비 방지)
  useEffect(() => {
    if (!user || !roomIdsKey) return
    const ids = roomIdsKey.split(',')
    const unsubs = ids.map((roomId) => {
      const q = query(
        collection(db, 'rooms', roomId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(40),
      )
      return onSnapshot(q, (snap) => {
        const msgs = snap.docs.map((d) => d.data() as { authorId: string; createdAt: { seconds: number } | null })
        setRecentByRoom((prev) => ({ ...prev, [roomId]: msgs }))
      })
    })
    return () => unsubs.forEach((u) => u())
  }, [user, roomIdsKey])

  // 읽음 시각/캐시가 바뀔 때만 로컬에서 뱃지 재계산 (추가 Firestore 읽기 없음)
  useEffect(() => {
    if (!user) return
    const next: Record<string, number> = {}
    for (const room of rooms) {
      next[room.id] = countUnreadMessages(recentByRoom[room.id] ?? [], myLastRead[room.id] ?? 0, user.uid)
    }
    setUnreadCounts(next)
  }, [user, rooms, myLastRead, recentByRoom])

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !roomName.trim()) return
    const joinCode = roomJoinCode.trim()
      ? normalizeJoinCode(roomJoinCode)
      : generateJoinCode()
    if (roomJoinCode.trim() && !isValidJoinCodeFormat(joinCode)) {
      alert('비밀번호는 영문과 숫자를 섞어 4~12자로 입력해주세요.')
      return
    }
    setCreating(true)
    try {
      let photoURL: string | undefined
      if (roomPhotoFile) {
        photoURL = await uploadToCloudinary(roomPhotoFile)
      }
      const docRef = await addDoc(collection(db, 'rooms'), {
        name: roomName.trim(),
        joinCode,
        ...(photoURL ? { photoURL } : {}),
        memberIds: [user.uid],
        memberCount: 1,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })
      setShowCreate(false)
      resetCreateForm()
      navigate(`/room/${docRef.id}`)
    } catch {
      toast('방 만들기에 실패했어요')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const code = normalizeJoinCode(joinCodeInput)
    if (!isValidJoinCodeFormat(code)) {
      setJoinCodeError('영문과 숫자를 섞어 4~12자로 입력해주세요.')
      return
    }
    setJoiningByCode(true)
    setJoinCodeError('')
    try {
      const q = query(collection(db, 'rooms'), where('joinCode', '==', code))
      const snap = await getDocs(q)
      if (snap.empty) {
        setJoinCodeError('해당 비밀번호의 방을 찾을 수 없어요.')
        return
      }
      const roomDoc = snap.docs[0]
      const data = roomDoc.data()
      if (!data.memberIds?.includes(user.uid)) {
        await updateDoc(roomDoc.ref, { memberIds: arrayUnion(user.uid) })
        await postJoinWelcome(roomDoc.id, {
          uid: user.uid,
          name: user.displayName || '친구',
          photoURL: user.photoURL,
        })
      }
      setShowJoinByCode(false)
      resetJoinForm()
      navigate(`/room/${roomDoc.id}`)
    } catch {
      setJoinCodeError('참여에 실패했어요. 다시 시도해주세요.')
    } finally {
      setJoiningByCode(false)
    }
  }

  return (
    <div className="page-enter app-shell min-h-screen">
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showOnboarding && (
        <OnboardingModal onDone={() => {
          localStorage.setItem('wuri_onboarded', '1')
          setShowOnboarding(false)
        }} />
      )}

      <header className="app-header safe-top sticky top-0 z-10 px-5 py-3.5 flex items-center justify-between">
        <h1 className="text-lg font-black tracking-tight text-[var(--text)]">
          WU<span className="text-[var(--brand)]">RI</span>
        </h1>
        <div className="flex items-center gap-1">
          <button type="button" onClick={toggleDark} className="icon-btn" aria-label="테마">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" onClick={() => setShowProfile(true)} className="w-9 h-9 rounded-full overflow-hidden border-2 border-[var(--brand)] ml-1">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center bg-[var(--brand)] text-white text-xs font-bold">{(user?.displayName ?? '?').slice(0, 2).toUpperCase()}</span>
            }
          </button>
          <button type="button" onClick={() => signOut(auth)} className="icon-btn ml-0.5" aria-label="로그아웃">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-5 pt-5 pb-8 space-y-5">
        <InstallBanner />
        <div>
          <p className="text-sm text-[var(--text-secondary)]">안녕하세요</p>
          <p className="text-lg font-bold text-[var(--text)] mt-0.5">{user?.displayName || '친구'}님</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary col-span-2 py-4 rounded-[var(--radius-xl)] shadow-[var(--shadow-card)]">
            <Plus size={20} />
            새 방 만들기
          </button>
          <button type="button" onClick={() => { resetJoinForm(); setShowJoinByCode(true) }} className="btn btn-secondary col-span-2 py-4 rounded-[var(--radius-xl)] text-[var(--brand)] border-[var(--brand-soft)] bg-[var(--brand-soft)]">
            <KeyRound size={18} />
            비밀번호로 참여
          </button>
        </div>

        {loadingRooms ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card p-4 flex items-center gap-4">
                <div className="w-12 h-12 skeleton rounded-[var(--radius-lg)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 skeleton rounded-lg w-1/2" />
                  <div className="h-3 skeleton rounded-lg w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="card py-16 px-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-[var(--radius-xl)] bg-[var(--brand-soft)] flex items-center justify-center mb-4">
              <Plus size={28} className="text-[var(--brand)]" />
            </div>
            <p className="font-bold text-[var(--text)] text-lg">아직 방이 없어요</p>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              새 방을 만들거나 비밀번호로<br />친구 방에 참여해보세요
            </p>
            <button type="button" onClick={() => setShowCreate(true)} className="mt-5 text-sm font-semibold text-[var(--brand)]">
              방 만들기 →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="label-caps px-1">내 방 · {rooms.length}</p>
            {rooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => navigate(`/room/${room.id}`)}
                className="card w-full p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="relative shrink-0">
                  <RoomAvatar photoURL={room.photoURL} emoji={room.emoji} name={room.name} className="w-12 h-12" />
                  {(unreadCounts[room.id] ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--surface)]">
                      {(unreadCounts[room.id] ?? 0) > 99 ? '99+' : unreadCounts[room.id]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-[var(--text)]">{room.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    멤버 {room.memberIds?.length ?? 1}명
                    {(unreadCounts[room.id] ?? 0) > 0 && (
                      <span className="text-rose-500 font-semibold ml-1">· 새 메시지</span>
                    )}
                  </p>
                </div>
                <ChevronRight size={18} className="text-[var(--text-muted)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <div className="modal-overlay">
          <div className="modal-sheet sheet-enter max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[var(--text)] mb-5">새 방 만들기</h3>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="label-caps block mb-2">방 사진</label>
                <div className="flex items-center gap-4">
                  <RoomAvatar
                    photoURL={roomPhotoPreview ?? undefined}
                    name={roomName}
                    className="w-16 h-16"
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="btn btn-secondary text-sm py-2 px-4"
                    >
                      사진 선택
                    </button>
                    {roomPhotoPreview && (
                      <button
                        type="button"
                        onClick={clearRoomPhoto}
                        className="px-4 py-2 rounded-xl text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                      >
                        사진 제거
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhotoSelect(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">갤러리에서 원하는 사진을 골라 방 대표 이미지로 쓸 수 있어요.</p>
              </div>
              <div>
                <label className="label-caps block mb-1">방 이름</label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="예: 우리 사이"
                  className="input-field"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label-caps block mb-1">방 비밀번호</label>
                <input
                  type="text"
                  value={roomJoinCode}
                  onChange={(e) => setRoomJoinCode(e.target.value.toUpperCase())}
                  placeholder="비워두면 자동 생성"
                  maxLength={12}
                  className="input-field uppercase tracking-widest"
                />
                <p className="text-xs text-[var(--text-muted)] mt-1">영문+숫자 4~12자</p>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowCreate(false); resetCreateForm() }} className="btn btn-secondary flex-1">취소</button>
                <button type="submit" disabled={creating || !roomName.trim()} className="btn btn-primary flex-1">{creating ? '만드는 중...' : '만들기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showJoinByCode && (
        <div className="modal-overlay">
          <div className="modal-sheet sheet-enter">
            <h3 className="text-lg font-bold text-[var(--text)] mb-1">비밀번호로 참여</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">방장에게 받은 비밀번호를 입력하세요</p>
            <form onSubmit={handleJoinByCode} className="space-y-4">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => { setJoinCodeInput(e.target.value.toUpperCase()); setJoinCodeError('') }}
                placeholder="K3M8P2"
                maxLength={12}
                className="input-field uppercase tracking-[0.2em] text-center font-bold"
                autoFocus
                required
              />
              {joinCodeError && <p className="text-sm text-rose-500 text-center">{joinCodeError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowJoinByCode(false); resetJoinForm() }} className="btn btn-secondary flex-1">취소</button>
                <button type="submit" disabled={joiningByCode || !joinCodeInput.trim()} className="btn btn-primary flex-1">{joiningByCode ? '참여 중...' : '참여하기'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
