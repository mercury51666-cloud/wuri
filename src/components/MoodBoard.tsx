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
  { emoji: '😄', label: '최고야' },
  { emoji: '😊', label: '좋아' },
  { emoji: '😐', label: '그냥' },
  { emoji: '😔', label: '우울' },
  { emoji: '😤', label: '짜증' },
  { emoji: '😴', label: '피곤' },
  { emoji: '🥰', label: '설렘' },
  { emoji: '🤩', label: '신남' },
]

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function formatTodayKo(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
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
    <div className="zenly-mood space-y-4">
      <div className="zenly-mood-picker">
        <div className="zenly-mood-picker-head">
          <p className="zenly-mood-title">오늘 기분 어때? 🫧</p>
          <p className="zenly-mood-date">{formatTodayKo(today)}</p>
        </div>
        <div className="zenly-mood-grid">
          {MOODS.map(({ emoji, label }) => (
            <button
              key={emoji}
              type="button"
              onClick={() => selectMood(emoji)}
              disabled={saving}
              className={`zenly-mood-btn ${myMood === emoji ? 'zenly-mood-btn-active' : ''}`}
            >
              <span className="zenly-mood-emoji">{emoji}</span>
              <span className="zenly-mood-label">{label}</span>
            </button>
          ))}
        </div>
        {myMood && (
          <p className="zenly-mood-mine">
            나는 지금 {myMood} mood!
          </p>
        )}
      </div>

      <div className="zenly-mood-board">
        <div className="zenly-mood-board-head">
          <h3>친구들 기분 모아보기</h3>
          <span className="zenly-mood-count">{todayMoods.length}명</span>
        </div>
        {todayMoods.length === 0 ? (
          <div className="zenly-mood-empty">
            <span>🫠</span>
            <p>아직 아무도 기분을 안 남겼어요</p>
            <p className="zenly-mood-empty-hint">먼저 하나 골라볼까?</p>
          </div>
        ) : (
          <div className="zenly-mood-bubbles">
            {todayMoods
              .sort((a, b) => {
                if (a.uid === user?.uid) return -1
                if (b.uid === user?.uid) return 1
                return b.updatedAt - a.updatedAt
              })
              .map((entry) => (
                <div
                  key={entry.uid}
                  className={`zenly-mood-bubble ${entry.uid === user?.uid ? 'zenly-mood-bubble-me' : ''}`}
                >
                  <div className="zenly-mood-bubble-avatar">
                    {entry.photoURL ? (
                      <img src={entry.photoURL} alt="" />
                    ) : (
                      <span>{entry.name.slice(0, 1)}</span>
                    )}
                  </div>
                  <span className="zenly-mood-bubble-emoji">{entry.mood}</span>
                  <span className="zenly-mood-bubble-name">
                    {entry.uid === user?.uid ? '나' : entry.name}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {moods.filter((m) => m.uid === user?.uid && m.date !== today).length > 0 && (
        <div className="zenly-mood-history">
          <div className="zenly-mood-board-head">
            <h3>내 기분 달력 📅</h3>
          </div>
          <div className="zenly-mood-history-list">
            {moods
              .filter((m) => m.uid === user?.uid)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 7)
              .map((entry) => (
                <div key={entry.date} className="zenly-mood-history-row">
                  <span className="zenly-mood-history-emoji">{entry.mood}</span>
                  <span className="zenly-mood-history-date">{formatTodayKo(entry.date)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {otherMoods.length > 0 && (
        <p className="zenly-mood-footer">
          자정이 되면 기분이 리셋돼요 🌙
        </p>
      )}
    </div>
  )
}
