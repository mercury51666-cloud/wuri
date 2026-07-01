import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { User } from 'firebase/auth'

export type RsvpStatus = 'yes' | 'no' | 'maybe'

interface RsvpDoc {
  status: RsvpStatus
  userName: string
}

interface Props {
  roomId: string
  eventId: string
  user: User | null
}

const OPTIONS: { status: RsvpStatus; label: string; active: string }[] = [
  { status: 'yes', label: '참석', active: 'bg-emerald-500 text-white border-emerald-500' },
  { status: 'no', label: '불참', active: 'bg-rose-500 text-white border-rose-500' },
  { status: 'maybe', label: '미정', active: 'bg-amber-500 text-white border-amber-500' },
]

function countByStatus(entries: RsvpDoc[], status: RsvpStatus) {
  return entries.filter((e) => e.status === status).length
}

export function RsvpCounts({ entries }: { entries: RsvpDoc[] }) {
  const yes = countByStatus(entries, 'yes')
  const no = countByStatus(entries, 'no')
  const maybe = countByStatus(entries, 'maybe')
  if (yes + no + maybe === 0) return null
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      참석 {yes} · 불참 {no} · 미정 {maybe}
    </p>
  )
}

export function UpcomingRsvp({ roomId, eventId }: { roomId: string; eventId: string }) {
  const [entries, setEntries] = useState<RsvpDoc[]>([])

  useEffect(() => {
    return onSnapshot(
      collection(db, 'rooms', roomId, 'events', eventId, 'rsvp'),
      (snap) => setEntries(snap.docs.map((d) => d.data() as RsvpDoc)),
    )
  }, [roomId, eventId])

  const yes = countByStatus(entries, 'yes')
  const no = countByStatus(entries, 'no')
  const maybe = countByStatus(entries, 'maybe')
  if (yes + no + maybe === 0) return null

  return (
    <p className="text-xs opacity-80">
      참석 {yes} · 불참 {no} · 미정 {maybe}
    </p>
  )
}

export default function EventRsvp({ roomId, eventId, user }: Props) {
  const [entries, setEntries] = useState<RsvpDoc[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onSnapshot(
      collection(db, 'rooms', roomId, 'events', eventId, 'rsvp'),
      (snap) => {
        setEntries(snap.docs.map((d) => d.data() as RsvpDoc))
      },
    )
  }, [roomId, eventId])

  const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null)

  useEffect(() => {
    if (!user) {
      setMyRsvp(null)
      return
    }
    return onSnapshot(doc(db, 'rooms', roomId, 'events', eventId, 'rsvp', user.uid), (snap) => {
      setMyRsvp(snap.exists() ? (snap.data().status as RsvpStatus) : null)
    })
  }, [roomId, eventId, user])

  const setRsvp = async (status: RsvpStatus) => {
    if (!user || saving) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'rooms', roomId, 'events', eventId, 'rsvp', user.uid), {
        status,
        userName: user.displayName || '친구',
        updatedAt: serverTimestamp(),
      })
    } finally {
      setSaving(false)
    }
  }

  const yesNames = entries.filter((e) => e.status === 'yes').map((e) => e.userName)
  const noNames = entries.filter((e) => e.status === 'no').map((e) => e.userName)

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/10">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">참석 여부</p>
      {user ? (
        <div className="flex gap-2 mb-2">
          {OPTIONS.map(({ status, label, active }) => (
            <button
              key={status}
              type="button"
              disabled={saving}
              onClick={() => setRsvp(status)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                myRsvp === status
                  ? active
                  : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-violet-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-2">로그인 후 선택할 수 있어요</p>
      )}
      <RsvpCounts entries={entries} />
      {(yesNames.length > 0 || noNames.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
          {yesNames.length > 0 && <p>✓ {yesNames.join(', ')}</p>}
          {noNames.length > 0 && <p>✗ {noNames.join(', ')}</p>}
        </div>
      )}
    </div>
  )
}
