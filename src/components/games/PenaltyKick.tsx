import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthState } from '../../hooks/useAuthState'

type Direction = 'left' | 'center' | 'right'
type Phase = 'ready' | 'choose' | 'result'

interface Score {
  id: string
  authorName: string
  goals: number
  attempts: number
  createdAt: { seconds: number } | null
}

interface Props {
  roomId: string
}

const DIRECTIONS: Direction[] = ['left', 'center', 'right']
const DIR_LABEL: Record<Direction, string> = { left: '왼쪽', center: '가운데', right: '오른쪽' }
const DIR_EMOJI: Record<Direction, string> = { left: '↖️', center: '⬆️', right: '↗️' }

export default function PenaltyKick({ roomId }: Props) {
  const { user } = useAuthState()
  const [phase, setPhase] = useState<Phase>('ready')
  const [playerChoice, setPlayerChoice] = useState<Direction | null>(null)
  const [keeperChoice, setKeeperChoice] = useState<Direction | null>(null)
  const [goals, setGoals] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [scores, setScores] = useState<Score[]>([])
  const [keeperAnim, setKeeperAnim] = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'penaltyScores'),
      orderBy('goals', 'desc'),
      limit(10)
    )
    return onSnapshot(q, (snap) => {
      setScores(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Score)))
    })
  }, [roomId])

  const startGame = () => {
    setPhase('choose')
    setPlayerChoice(null)
    setKeeperChoice(null)
  }

  const kick = (dir: Direction) => {
    if (phase !== 'choose') return
    const keeper = DIRECTIONS[Math.floor(Math.random() * 3)]
    setPlayerChoice(dir)
    setKeeperChoice(keeper)
    setKeeperAnim(true)
    setTimeout(() => setKeeperAnim(false), 600)

    const scored = dir !== keeper
    const newGoals = goals + (scored ? 1 : 0)
    const newAttempts = attempts + 1
    setGoals(newGoals)
    setAttempts(newAttempts)
    setPhase('result')
  }

  const saveScore = async () => {
    if (!user) return
    await addDoc(collection(db, 'rooms', roomId, 'penaltyScores'), {
      authorId: user.uid,
      authorName: user.displayName || '친구',
      goals,
      attempts,
      rate: attempts > 0 ? Math.round((goals / attempts) * 100) : 0,
      createdAt: serverTimestamp(),
    })
    setGoals(0)
    setAttempts(0)
    setPhase('ready')
  }

  const isGoal = playerChoice !== null && keeperChoice !== null && playerChoice !== keeperChoice

  return (
    <div className="p-4 space-y-4">
      {/* 게임 영역 */}
      <div className="bg-gradient-to-b from-green-400 to-green-600 rounded-3xl p-6 text-center relative overflow-hidden">
        {/* 골대 */}
        <div className="border-4 border-white rounded-t-lg mx-auto mb-4 relative"
          style={{ width: '80%', height: '80px' }}>
          {/* 골키퍼 */}
          <div className={`absolute bottom-0 text-4xl transition-all duration-300 ${
            keeperAnim ? 'scale-125' : ''
          } ${
            keeperChoice === 'left' ? 'left-0' :
            keeperChoice === 'right' ? 'right-0' :
            'left-1/2 -translate-x-1/2'
          }`}>
            🧤
          </div>

          {/* 골 효과 */}
          {phase === 'result' && isGoal && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-4xl animate-bounce">⚽</div>
            </div>
          )}
        </div>

        {/* 상태 메시지 */}
        <div className="text-white font-black text-2xl mb-2">
          {phase === 'ready' && '⚽ 페널티킥!'}
          {phase === 'choose' && '어디로 찰까요?'}
          {phase === 'result' && (isGoal ? '🎉 골!!!' : '🧤 막혔다!')}
        </div>

        {/* 점수 */}
        <div className="text-white/80 text-sm">
          {attempts}번 중 {goals}골 ({attempts > 0 ? Math.round(goals / attempts * 100) : 0}%)
        </div>
      </div>

      {/* 버튼 영역 */}
      {phase === 'ready' && (
        <button
          onClick={startGame}
          className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-black text-lg rounded-2xl"
        >
          ⚽ 킥 시작!
        </button>
      )}

      {phase === 'choose' && (
        <div className="grid grid-cols-3 gap-3">
          {DIRECTIONS.map((dir) => (
            <button
              key={dir}
              onClick={() => kick(dir)}
              className="py-4 bg-white rounded-2xl shadow-sm hover:bg-violet-50 hover:shadow-md transition-all flex flex-col items-center gap-1"
            >
              <span className="text-2xl">{DIR_EMOJI[dir]}</span>
              <span className="text-xs font-semibold text-gray-600">{DIR_LABEL[dir]}</span>
            </button>
          ))}
        </div>
      )}

      {phase === 'result' && (
        <div className="space-y-3">
          {/* 결과 */}
          <div className={`rounded-2xl p-4 text-center ${isGoal ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-sm font-medium ${isGoal ? 'text-green-600' : 'text-red-500'}`}>
              나: {DIR_LABEL[playerChoice!]} {DIR_EMOJI[playerChoice!]} &nbsp;|&nbsp; 골키퍼: {DIR_LABEL[keeperChoice!]} {DIR_EMOJI[keeperChoice!]}
            </p>
            <p className={`text-xl font-black mt-1 ${isGoal ? 'text-green-600' : 'text-red-500'}`}>
              {isGoal ? '🎯 GOAL!' : '💨 MISS...'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={startGame}
              className="py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl"
            >
              한 번 더!
            </button>
            <button
              onClick={saveScore}
              className="py-3 bg-violet-500 hover:bg-violet-600 text-white font-bold rounded-xl"
            >
              기록 저장
            </button>
          </div>
        </div>
      )}

      {/* 랭킹 */}
      {scores.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-3">🏆 방 랭킹</h3>
          <div className="space-y-2">
            {scores.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-lg w-6 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-700">{s.authorName}</span>
                <span className="text-sm text-violet-600 font-bold">{s.goals}골</span>
                <span className="text-xs text-gray-400">({s.attempts}번)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
