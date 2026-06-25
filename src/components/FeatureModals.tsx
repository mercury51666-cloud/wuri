import { useState } from 'react'

interface Props {
  showPoll: boolean
  showSchedule: boolean
  showBirthday: boolean
  onClose: () => void
  onCreatePoll: (q: string, opts: string[]) => void
  onSchedule: (text: string, minutes: number) => void
  onSaveBirthday: (mmdd: string) => void
}

export function FeatureModals({
  showPoll, showSchedule, showBirthday,
  onClose, onCreatePoll, onSchedule, onSaveBirthday,
}: Props) {
  const [pollQ, setPollQ] = useState('')
  const [pollO1, setPollO1] = useState('')
  const [pollO2, setPollO2] = useState('')
  const [schedText, setSchedText] = useState('')
  const [schedMin, setSchedMin] = useState('5')
  const [birthday, setBirthday] = useState('')

  if (!showPoll && !showSchedule && !showBirthday) return null

  return (
    <div className="fixed inset-0 z-[4000] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5 sheet-enter" onClick={(e) => e.stopPropagation()}>
        {showPoll && (
          <>
            <h3 className="font-bold mb-3">📊 투표 만들기</h3>
            <input className="input-field w-full mb-2" placeholder="질문" value={pollQ} onChange={(e) => setPollQ(e.target.value)} />
            <input className="input-field w-full mb-2" placeholder="선택 1" value={pollO1} onChange={(e) => setPollO1(e.target.value)} />
            <input className="input-field w-full mb-3" placeholder="선택 2" value={pollO2} onChange={(e) => setPollO2(e.target.value)} />
            <button type="button" className="btn w-full" onClick={() => { onCreatePoll(pollQ, [pollO1, pollO2].filter(Boolean)); onClose() }}>만들기</button>
          </>
        )}
        {showSchedule && (
          <>
            <h3 className="font-bold mb-3">⏰ 메시지 예약</h3>
            <textarea className="input-field w-full mb-2 min-h-[80px]" placeholder="내용" value={schedText} onChange={(e) => setSchedText(e.target.value)} />
            <input className="input-field w-full mb-3" type="number" min={1} placeholder="몇 분 후" value={schedMin} onChange={(e) => setSchedMin(e.target.value)} />
            <button type="button" className="btn w-full" onClick={() => { onSchedule(schedText, Number(schedMin) || 5); onClose() }}>예약</button>
          </>
        )}
        {showBirthday && (
          <>
            <h3 className="font-bold mb-3">🎂 생일 등록</h3>
            <input className="input-field w-full mb-3" placeholder="MM-DD (예: 03-15)" value={birthday} onChange={(e) => setBirthday(e.target.value)} maxLength={5} />
            <button type="button" className="btn w-full" onClick={() => { onSaveBirthday(birthday); onClose() }}>저장</button>
          </>
        )}
      </div>
    </div>
  )
}

export function ChatFeatureBar({ onPoll, onSchedule }: {
  onPoll: () => void
  onSchedule: () => void
}) {
  return (
    <div className="flex gap-1 px-3 pt-1.5 overflow-x-auto scrollbar-hide">
      <button type="button" onClick={onPoll} className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]">📊 투표</button>
      <button type="button" onClick={onSchedule} className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]">⏰ 예약</button>
    </div>
  )
}
