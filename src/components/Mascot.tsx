import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc, increment, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'

interface MascotData {
  totalPats: number
  lastPatBy: string
  name: string
}

interface Props {
  roomId: string
  totalMessages: number
}

const LEVELS = [
  { min: 0,   emoji: '🥚', name: '알',      desc: '따뜻하게 키워주세요!' },
  { min: 30,  emoji: '🐣', name: '아기',    desc: '막 태어났어요!' },
  { min: 100, emoji: '🐥', name: '병아리',  desc: '조금씩 자라고 있어요' },
  { min: 300, emoji: '🐓', name: '닭',      desc: '많이 컸네요!' },
  { min: 600, emoji: '🦅', name: '독수리',  desc: '하늘을 날 수 있어요!' },
]

function getLevel(msgs: number) {
  let level = LEVELS[0]
  for (const l of LEVELS) {
    if (msgs >= l.min) level = l
  }
  return level
}

function getNextLevel(msgs: number) {
  for (const l of LEVELS) {
    if (msgs < l.min) return l
  }
  return null
}

export default function Mascot({ roomId, totalMessages }: Props) {
  const { user } = useAuthState()
  const [mascot, setMascot] = useState<MascotData>({ totalPats: 0, lastPatBy: '', name: '우리 아이' })
  const [patAnim, setPatAnim] = useState(false)
  const [editName, setEditName] = useState(false)
  const [newName, setNewName] = useState('')

  const level = getLevel(totalMessages)
  const next = getNextLevel(totalMessages)

  useEffect(() => {
    const ref = doc(db, 'rooms', roomId, 'meta', 'mascot')
    return onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        await setDoc(ref, { totalPats: 0, lastPatBy: '', name: '우리 아이' })
      } else {
        setMascot(snap.data() as MascotData)
      }
    })
  }, [roomId])

  const pat = async () => {
    if (!user) return
    setPatAnim(true)
    setTimeout(() => setPatAnim(false), 600)
    const ref = doc(db, 'rooms', roomId, 'meta', 'mascot')
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, { totalPats: 1, lastPatBy: user.displayName || '친구', name: '우리 아이' })
    } else {
      await setDoc(ref, {
        ...snap.data(),
        totalPats: increment(1),
        lastPatBy: user.displayName || '친구',
      }, { merge: true })
    }
  }

  const saveName = async () => {
    if (!newName.trim()) return
    const ref = doc(db, 'rooms', roomId, 'meta', 'mascot')
    await setDoc(ref, { name: newName.trim() }, { merge: true })
    setEditName(false)
    setNewName('')
  }

  const progress = next
    ? Math.round(((totalMessages - level.min) / (next.min - level.min)) * 100)
    : 100

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm">
      {/* 마스코트 */}
      <div className="text-center">
        <button
          onClick={pat}
          className={`text-7xl transition-transform select-none ${patAnim ? 'scale-125' : 'scale-100 hover:scale-110'}`}
        >
          {level.emoji}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">탭해서 쓰다듬기 ({mascot.totalPats}번)</p>
      </div>

      {/* 이름 */}
      <div className="text-center mt-2">
        {editName ? (
          <div className="flex gap-2 justify-center">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="이름 입력..."
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400 w-32"
              autoFocus
            />
            <button onClick={saveName} className="text-xs bg-violet-500 text-white px-3 py-1.5 rounded-lg">저장</button>
            <button onClick={() => setEditName(false)} className="text-xs text-gray-400 px-2">취소</button>
          </div>
        ) : (
          <button onClick={() => { setEditName(true); setNewName(mascot.name) }}
            className="text-base font-black text-gray-800 dark:text-gray-100 hover:text-violet-500 transition-colors">
            {mascot.name} ✏️
          </button>
        )}
        <p className="text-xs text-violet-500 font-medium">{level.name} 단계 · {level.desc}</p>
      </div>

      {/* 성장 게이지 */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
          <span>메시지 {totalMessages}개</span>
          {next ? <span>다음: {next.emoji} {next.name} ({next.min}개)</span> : <span>최고 레벨!</span>}
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-violet-400 to-pink-400 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {mascot.lastPatBy && (
        <p className="text-xs text-center text-gray-300 dark:text-gray-600 mt-2">
          마지막으로 {mascot.lastPatBy}이(가) 쓰다듬었어요 💜
        </p>
      )}
    </div>
  )
}
