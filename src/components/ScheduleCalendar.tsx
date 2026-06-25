import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../contexts/ToastContext'

interface Props {
  roomId: string
}

interface ScheduleEvent {
  id: string
  title: string
  date: string
  time?: string
  memo?: string
  authorId: string
  authorName: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function formatDisplayDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function getDaysUntil(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function dDayLabel(days: number) {
  if (days === 0) return 'D-Day'
  if (days > 0) return `D-${days}`
  return `D+${Math.abs(days)}`
}

export default function ScheduleCalendar({ roomId }: Props) {
  const { user } = useAuthState()
  const { toast } = useToast()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()))
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'rooms', roomId, 'events'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleEvent)))
    })
  }, [roomId])

  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {}
    events.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    })
    return map
  }, [events])

  const upcoming = useMemo(
    () => events.filter((ev) => getDaysUntil(ev.date) >= 0).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
    [events],
  )

  const selectedEvents = eventsByDate[selectedDate] ?? []

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  const openAdd = (date?: string) => {
    setTitle('')
    setTime('')
    setMemo('')
    if (date) setSelectedDate(date)
    setShowAdd(true)
  }

  const addEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !title.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'rooms', roomId, 'events'), {
        title: title.trim(),
        date: selectedDate,
        ...(time ? { time } : {}),
        ...(memo.trim() ? { memo: memo.trim() } : {}),
        authorId: user.uid,
        authorName: user.displayName || '친구',
        createdAt: serverTimestamp(),
      })
      setShowAdd(false)
      toast('약속을 추가했어요')
    } catch {
      toast('약속 추가에 실패했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  const removeEvent = async (ev: ScheduleEvent) => {
    if (!confirm(`"${ev.title}" 약속을 삭제할까요?`)) return
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'events', ev.id))
      toast('약속을 삭제했어요')
    } catch {
      toast('약속 삭제에 실패했어요')
    }
  }

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <div className="space-y-4">
      {/* 다가오는 약속 */}
      {upcoming.length > 0 && (
        <div className="bg-gradient-to-r from-violet-500 to-pink-500 rounded-2xl p-4 text-white shadow-lg shadow-violet-200 dark:shadow-none">
          <p className="text-xs font-semibold opacity-80 tracking-widest uppercase mb-2">다가오는 약속</p>
          <div className="space-y-2">
            {upcoming.slice(0, 3).map((ev) => {
              const days = getDaysUntil(ev.date)
              return (
                <div key={ev.id} className="flex items-center gap-3 bg-white/15 rounded-xl px-3 py-2">
                  <span className="text-sm font-black shrink-0">{dDayLabel(days)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{ev.title}</p>
                    <p className="text-xs opacity-80">{formatDisplayDate(ev.date)}{ev.time ? ` · ${ev.time}` : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 캘린더 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={prevMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">‹</button>
          <p className="font-bold text-gray-800 dark:text-white">{viewYear}년 {viewMonth + 1}월</p>
          <button type="button" onClick={nextMonth} className="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">›</button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />
            const dateStr = toDateStr(viewYear, viewMonth, day)
            const hasEvents = !!eventsByDate[dateStr]?.length
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === todayStr
            const dow = (firstDay + day - 1) % 7
            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold transition-all relative ${
                  isSelected
                    ? 'bg-violet-500 text-white shadow-md'
                    : isToday
                      ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400'
                      : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300'
                } ${!isSelected && dow === 0 ? 'text-rose-400' : ''} ${!isSelected && dow === 6 ? 'text-blue-400' : ''}`}
              >
                {day}
                {hasEvents && (
                  <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-violet-400'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택한 날짜 */}
      <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white text-sm">{formatDisplayDate(selectedDate)}</h3>
            {selectedEvents.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">{selectedEvents.length}개의 약속</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => openAdd(selectedDate)}
            className="text-sm font-semibold text-violet-500 dark:text-violet-400 hover:underline"
          >
            + 추가
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-2">📅</p>
            <p className="text-sm text-gray-400 dark:text-gray-600 mb-3">이 날 약속이 없어요</p>
            <button
              type="button"
              onClick={() => openAdd(selectedDate)}
              className="text-sm text-violet-500 dark:text-violet-400 font-semibold"
            >
              약속 추가하기
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {selectedEvents
              .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
              .map((ev) => (
                <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 dark:text-white">{ev.title}</p>
                    {ev.time && <p className="text-sm text-violet-500 dark:text-violet-400 mt-0.5">🕐 {ev.time}</p>}
                    {ev.memo && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ev.memo}</p>}
                    <p className="text-xs text-gray-400 mt-1">{ev.authorName}이(가) 추가</p>
                  </div>
                  {ev.authorId === user?.uid && (
                    <button
                      type="button"
                      onClick={() => removeEvent(ev)}
                      className="text-xs text-gray-400 hover:text-rose-500 px-2 py-1 shrink-0"
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-end justify-center z-[2500] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/10 rounded-3xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">약속 추가</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{formatDisplayDate(selectedDate)}</p>
            <form onSubmit={addEvent} className="space-y-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="약속 이름 (예: 저녁 회식)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ fontSize: '16px' }}
                required
                maxLength={40}
                autoFocus
              />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ fontSize: '16px' }}
              />
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="메모 (장소 등, 선택)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                style={{ fontSize: '16px' }}
                maxLength={80}
              />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 font-medium">취소</button>
                <button type="submit" disabled={saving || !title.trim()} className="flex-1 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-bold">
                  {saving ? '저장 중...' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
