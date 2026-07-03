import { useEffect, useMemo, useState } from 'react'

import {

  collection,

  query,

  orderBy,

  onSnapshot,

  addDoc,

  deleteDoc,

  getDocs,

  doc,

  serverTimestamp,

} from 'firebase/firestore'

import { db } from '../firebase'

import { useAuthState } from '../hooks/useAuthState'

import { useToast } from '../contexts/ToastContext'

import EventRsvp, { UpcomingRsvp } from './EventRsvp'



interface Props {

  roomId: string

}



interface ScheduleEvent {

  id: string

  title: string

  date: string

  time?: string

  memo?: string

  emoji?: string

  pinDday?: boolean

  authorId: string

  authorName: string

}



const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const EMOJI_PRESETS = ['📅', '🎂', '✈️', '🎓', '💕', '🎉', '🏕️', '🍻']



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



function dDayTone(days: number) {

  if (days === 0) return 'dday-card-today'

  if (days > 0 && days <= 7) return 'dday-card-soon'

  if (days > 0) return 'dday-card-future'

  return 'dday-card-past'

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

  const [emoji, setEmoji] = useState('📅')

  const [pinDday, setPinDday] = useState(false)

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



  const ddayBoard = useMemo(() => {

    return events

      .map((ev) => ({ ...ev, days: getDaysUntil(ev.date) }))

      .filter((ev) => ev.pinDday || ev.days >= -14)

      .sort((a, b) => {

        if (a.pinDday !== b.pinDday) return a.pinDday ? -1 : 1

        if (a.days >= 0 && b.days >= 0) return a.days - b.days || a.date.localeCompare(b.date)

        if (a.days >= 0) return -1

        if (b.days >= 0) return 1

        return b.days - a.days

      })

      .slice(0, 8)

  }, [events])



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

    setEmoji('📅')

    setPinDday(false)

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

        emoji,

        pinDday,

        ...(time ? { time } : {}),

        ...(memo.trim() ? { memo: memo.trim() } : {}),

        authorId: user.uid,

        authorName: user.displayName || '친구',

        createdAt: serverTimestamp(),

      })

      setShowAdd(false)

      toast('일정을 추가했어요')

    } catch {

      toast('일정 추가에 실패했어요. 잠시 후 다시 시도해 주세요')

    } finally {

      setSaving(false)

    }

  }



  const removeEvent = async (ev: ScheduleEvent) => {

    if (!confirm(`"${ev.title}" 일정을 삭제할까요?`)) return

    try {

      const rsvpSnap = await getDocs(collection(db, 'rooms', roomId, 'events', ev.id, 'rsvp'))

      await Promise.all(rsvpSnap.docs.map((d) => deleteDoc(d.ref)))

      await deleteDoc(doc(db, 'rooms', roomId, 'events', ev.id))

      toast('일정을 삭제했어요')

    } catch {

      toast('일정 삭제에 실패했어요')

    }

  }



  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())



  return (

    <div className="space-y-4">

      {/* D-day 보드 (일정과 같은 events 저장) */}

      <div className="dday-board-shell">

        <div className="dday-board-head">

          <div>

            <p className="dday-board-title">🗓️ D-day 보드</p>

            <p className="dday-board-sub">약속 · 생일 · 여행 — 한곳에 저장돼요</p>

          </div>

          <button type="button" onClick={() => openAdd()} className="dday-board-add">

            + 추가

          </button>

        </div>



        {ddayBoard.length === 0 ? (

          <div className="dday-board-empty">

            <p>아직 D-day가 없어요</p>

            <p className="dday-board-empty-hint">여행, 시험, 생일… 날짜만 넣어도 D-day가 계산돼요</p>

          </div>

        ) : (

          <div className="dday-board-scroll">

            {ddayBoard.map((ev) => (

              <button

                key={ev.id}

                type="button"

                onClick={() => setSelectedDate(ev.date)}

                className={`dday-card ${dDayTone(ev.days)}`}

              >

                <span className="dday-card-badge">{dDayLabel(ev.days)}</span>

                <span className="dday-card-emoji">{ev.emoji ?? '📅'}</span>

                <span className="dday-card-title">{ev.title}</span>

                <span className="dday-card-date">{formatDisplayDate(ev.date)}</span>

                {ev.time && <span className="dday-card-time">🕐 {ev.time}</span>}

                <UpcomingRsvp roomId={roomId} eventId={ev.id} />

                {ev.pinDday && <span className="dday-card-pin">📌</span>}

              </button>

            ))}

          </div>

        )}

      </div>



      {/* 캘린더 */}

      <div className="card p-4">

        <div className="flex items-center justify-between mb-4">

          <button type="button" onClick={prevMonth} className="icon-btn" aria-label="이전 달">‹</button>

          <p className="font-bold text-[var(--text)]">{viewYear}년 {viewMonth + 1}월</p>

          <button type="button" onClick={nextMonth} className="icon-btn" aria-label="다음 달">›</button>

        </div>



        <div className="grid grid-cols-7 gap-1 mb-1">

          {WEEKDAYS.map((w, i) => (

            <div key={w} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-[var(--text-muted)]'}`}>{w}</div>

          ))}

        </div>



        <div className="grid grid-cols-7 gap-1">

          {cells.map((day, idx) => {

            if (!day) return <div key={`empty-${idx}`} />

            const dateStr = toDateStr(viewYear, viewMonth, day)

            const dayEvents = eventsByDate[dateStr] ?? []

            const hasEvents = dayEvents.length > 0

            const isSelected = dateStr === selectedDate

            const isToday = dateStr === todayStr

            const dow = (firstDay + day - 1) % 7

            const nearestDays = hasEvents

              ? Math.min(...dayEvents.map((ev) => Math.abs(getDaysUntil(ev.date))))

              : null

            return (

              <button

                key={dateStr}

                type="button"

                onClick={() => setSelectedDate(dateStr)}

                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-semibold transition-all relative ${

                  isSelected

                    ? 'bg-[var(--brand)] text-white shadow-md'

                    : isToday

                      ? 'bg-[var(--brand-soft)] text-[var(--brand)]'

                      : 'hover:bg-[var(--surface-2)] text-[var(--text)]'

                } ${!isSelected && dow === 0 ? 'text-rose-400' : ''} ${!isSelected && dow === 6 ? 'text-blue-400' : ''}`}

              >

                {day}

                {hasEvents && nearestDays === 0 && (

                  <span className="absolute top-1 text-[8px] font-black opacity-90">D</span>

                )}

                {hasEvents && (

                  <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[var(--brand)]'}`} />

                )}

              </button>

            )

          })}

        </div>

      </div>



      {/* 선택한 날짜 */}

      <div className="card overflow-hidden">

        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">

          <div>

            <h3 className="font-bold text-[var(--text)] text-sm">{formatDisplayDate(selectedDate)}</h3>

            {selectedEvents.length > 0 && (

              <p className="text-xs text-[var(--text-muted)] mt-0.5">{selectedEvents.length}개의 일정</p>

            )}

          </div>

          <button type="button" onClick={() => openAdd(selectedDate)} className="text-sm font-semibold text-[var(--brand)]">

            + 추가

          </button>

        </div>



        {selectedEvents.length === 0 ? (

          <div className="py-10 text-center">

            <p className="text-3xl mb-2">📅</p>

            <p className="text-sm text-[var(--text-muted)] mb-3">이 날 일정이 없어요</p>

            <button type="button" onClick={() => openAdd(selectedDate)} className="text-sm text-[var(--brand)] font-semibold">

              일정 · D-day 추가

            </button>

          </div>

        ) : (

          <div className="divide-y divide-[var(--border)]">

            {selectedEvents

              .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))

              .map((ev) => {

                const days = getDaysUntil(ev.date)

                return (

                  <div key={ev.id} className="px-4 py-3">

                    <div className="flex items-start gap-3">

                      <div className={`dday-inline-badge ${dDayTone(days)}`}>{dDayLabel(days)}</div>

                      <div className="flex-1 min-w-0">

                        <p className="font-bold text-[var(--text)]">

                          <span className="mr-1">{ev.emoji ?? '📅'}</span>

                          {ev.title}

                          {ev.pinDday && <span className="text-xs ml-1">📌</span>}

                        </p>

                        {ev.time && <p className="text-sm text-[var(--brand)] mt-0.5">🕐 {ev.time}</p>}

                        {ev.memo && <p className="text-sm text-[var(--text-secondary)] mt-1">{ev.memo}</p>}

                        <p className="text-xs text-[var(--text-muted)] mt-1">{ev.authorName}이(가) 추가</p>

                      </div>

                      {ev.authorId === user?.uid && (

                        <button type="button" onClick={() => removeEvent(ev)} className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] px-2 py-1 shrink-0">

                          삭제

                        </button>

                      )}

                    </div>

                    <EventRsvp roomId={roomId} eventId={ev.id} user={user} />

                  </div>

                )

              })}

          </div>

        )}

      </div>



      {showAdd && (

        <div className="modal-overlay items-end">

          <div className="modal-sheet sheet-enter w-full max-w-md p-6">

            <h3 className="text-lg font-bold text-[var(--text)] mb-1">일정 · D-day 추가</h3>

            <p className="text-sm text-[var(--text-secondary)] mb-4">{formatDisplayDate(selectedDate)}</p>

            <form onSubmit={addEvent} className="space-y-3">

              <div>

                <p className="label-caps mb-2">아이콘</p>

                <div className="flex flex-wrap gap-2">

                  {EMOJI_PRESETS.map((e) => (

                    <button

                      key={e}

                      type="button"

                      onClick={() => setEmoji(e)}

                      className={`w-10 h-10 rounded-xl text-xl transition-all ${emoji === e ? 'bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]' : 'bg-[var(--surface-2)]'}`}

                    >

                      {e}

                    </button>

                  ))}

                </div>

              </div>

              <input

                type="text"

                value={title}

                onChange={(e) => setTitle(e.target.value)}

                placeholder="이름 (예: 부산 여행, 수능, 민수 생일)"

                className="input-field w-full"

                style={{ fontSize: '16px' }}

                required

                maxLength={40}

                autoFocus

              />

              <input

                type="time"

                value={time}

                onChange={(e) => setTime(e.target.value)}

                className="input-field w-full"

                style={{ fontSize: '16px' }}

              />

              <input

                type="text"

                value={memo}

                onChange={(e) => setMemo(e.target.value)}

                placeholder="메모 (장소 등, 선택)"

                className="input-field w-full"

                style={{ fontSize: '16px' }}

                maxLength={80}

              />

              <label className="flex items-center gap-2 py-1 cursor-pointer">

                <input

                  type="checkbox"

                  checked={pinDday}

                  onChange={(e) => setPinDday(e.target.checked)}

                  className="rounded border-[var(--border)]"

                />

                <span className="text-sm text-[var(--text-secondary)]">D-day 보드에 고정 📌</span>

              </label>

              <div className="flex gap-3 pt-1">

                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-secondary flex-1">취소</button>

                <button type="submit" disabled={saving || !title.trim()} className="btn btn-primary flex-1">

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


