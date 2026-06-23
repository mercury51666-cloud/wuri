import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'

const MISSIONS = [
  { emoji: '📸', text: '오늘 하늘 사진 찍어서 올리기' },
  { emoji: '🎵', text: '지금 듣고 있는 노래 공유하기' },
  { emoji: '🍽️', text: '오늘 먹은 것 중 제일 맛있던 거 말하기' },
  { emoji: '💌', text: '방 멤버 한 명에게 칭찬 한 마디' },
  { emoji: '🤔', text: '요즘 고민 하나 털어놓기' },
  { emoji: '😂', text: '요즘 제일 웃겼던 순간 공유' },
  { emoji: '🌙', text: '오늘 하루 한 줄 일기 쓰기' },
  { emoji: '🎮', text: '지금 바로 페널티킥 한 판!' },
  { emoji: '⚖️', text: '밸런스 게임 문제 하나 만들기' },
  { emoji: '🏃', text: '오늘 운동했는지 인증하기' },
  { emoji: '📚', text: '요즘 읽는 책 or 보는 드라마 추천' },
  { emoji: '🌈', text: '오늘 기분을 색깔로 표현하기' },
  { emoji: '🎂', text: '좋아하는 음식 랭킹 Top 3 공유' },
  { emoji: '✈️', text: '가장 가고 싶은 여행지 말하기' },
  { emoji: '💤', text: '어젯밤 꿈 이야기 공유하기' },
]

function getTodayMission() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  return MISSIONS[dayOfYear % MISSIONS.length]
}

interface MissionData {
  date: string
  completedBy: string[]
}

interface Props {
  roomId: string
}

export default function DailyMission({ roomId }: Props) {
  const { user } = useAuthState()
  const [data, setData] = useState<MissionData | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const mission = getTodayMission()

  useEffect(() => {
    const ref = doc(db, 'rooms', roomId, 'meta', `mission_${today}`)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setData(snap.data() as MissionData)
      else setData({ date: today, completedBy: [] })
    })
  }, [roomId, today])

  const complete = async () => {
    if (!user) return
    const ref = doc(db, 'rooms', roomId, 'meta', `mission_${today}`)
    await setDoc(ref, {
      date: today,
      completedBy: arrayUnion(user.uid),
    }, { merge: true })
  }

  const isDone = data?.completedBy.includes(user?.uid ?? '') ?? false
  const doneCount = data?.completedBy.length ?? 0

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-3xl p-5 border border-amber-100 dark:border-amber-800">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
          오늘의 미션
        </span>
        <span className="text-xs text-gray-400">{today}</span>
      </div>

      <div className="flex items-start gap-3">
        <span className="text-3xl">{mission.emoji}</span>
        <div className="flex-1">
          <p className="font-bold text-gray-800 dark:text-gray-100">{mission.text}</p>
          {doneCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {doneCount}명 완료 ✓
            </p>
          )}
        </div>
      </div>

      <button
        onClick={complete}
        disabled={isDone}
        className={`mt-4 w-full py-2.5 rounded-xl font-bold text-sm transition-colors ${
          isDone
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        }`}
      >
        {isDone ? '✓ 완료했어요!' : '완료하기'}
      </button>
    </div>
  )
}
