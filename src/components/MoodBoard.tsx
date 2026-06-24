import { useEffect, useState } from 'react'
import { doc, setDoc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'

interface Props {
  roomId: string
}

interface MoodEntry {
  uid: string
  name: string
  photoURL?: string
  mood: string
  date: string
  updatedAt: number
}

const MOODS = [
  { emoji: '😄', label: '최고' },
  { emoji: '😊', label: '좋음' },
  { emoji: '😐', label: '보통' },
  { emoji: '😔', label: '별로' },
  { emoji: '😤', label: '화남' },
  { emoji: '😴', label: '피곤' },
  { emoji: '🥰', label: '설렘' },
  { emoji: '🤩', label: '신남' },
]

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export default function MoodBoard({ roomId }: Props) {
  const { user } = useAuthState()
  const [moods, setMoods] = useState<MoodEntry[]>([])
  const [myMood, setMyMood] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const today = getToday()

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'rooms', roomId, 'moods'), (snap) => {
      const entries = snap.docs.map((d) => d.data() as MoodEntry)
      setMoods(entries)
      const mine = entries.find((e) => e.uid === user?.uid && e.date === today)
      setMyMood(mine?.mood ?? null)
    })
    return () => unsub()
  }, [roomId, user, today])

  const selectMood = async (emoji: string) => {
    if (!user || saving) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'rooms', roomId, 'moods', user.uid), {
        uid: user.uid,
        name: user.displayName || '친구',
        photoURL: user.photoURL || '',
        mood: emoji,
        date: today,
        updatedAt: Date.now(),
      })
    } finally {
      setSaving(false)
    }
  }

  const todayMoods = moods.filter((m) => m.date === today)
  const otherMoods = todayMoods.filter((m) => m.uid !== user?.uid)

  return (
    <div className="space-y-4">
      {/* 내 기분 선택 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-5">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">오늘 나의 기분은?</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">
          {today} · 하루에 한 번 바꿀 수 있어요
        </p>
        <div className="grid grid-cols-4 gap-2">
          {MOODS.map(({ emoji, label }) => (
            <button
              key={emoji}
              onClick={() => selectMood(emoji)}
              disabled={saving}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl transition-all active:scale-90 ${
                myMood === emoji
                  ? 'bg-violet-100 dark:bg-violet-500/20 ring-2 ring-violet-400 dark:ring-violet-500'
                  : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</span>
            </button>
          ))}
        </div>
        {myMood && (
          <p className="text-center text-sm text-violet-500 dark:text-violet-400 font-semibold mt-4">
            오늘 내 기분: {myMood}
          </p>
        )}
      </div>

      {/* 멤버들 기분 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">😊 오늘 모두의 기분</h3>
        </div>
        {todayMoods.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-2">🤷</p>
            <p className="text-sm text-gray-400 dark:text-gray-600">아직 아무도 기분을 남기지 않았어요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {todayMoods
              .sort((a, b) => {
                if (a.uid === user?.uid) return -1
                if (b.uid === user?.uid) return 1
                return b.updatedAt - a.updatedAt
              })
              .map((entry) => (
                <div key={entry.uid} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-500/20 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-600 dark:text-violet-300 shrink-0">
                    {entry.photoURL
                      ? <img src={entry.photoURL} alt={entry.name} className="w-full h-full object-cover" />
                      : entry.name[0]
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                      {entry.name}
                      {entry.uid === user?.uid && <span className="text-xs text-violet-400 ml-1">(나)</span>}
                    </p>
                  </div>
                  <span className="text-3xl">{entry.mood}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 지난 기분 (나) */}
      {moods.filter((m) => m.uid === user?.uid && m.date !== today).length > 0 && (
        <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">📅 내 기분 기록</h3>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {moods
              .filter((m) => m.uid === user?.uid)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 7)
              .map((entry) => (
                <div key={entry.date} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-2xl">{entry.mood}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{entry.date}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {otherMoods.length > 0 && (
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 pb-2">
          기분은 매일 자정에 초기화돼요
        </p>
      )}
    </div>
  )
}
