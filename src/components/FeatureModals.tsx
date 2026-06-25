import { useState } from 'react'
import { PRESET_TITLES } from '../utils/roomFeatures'

interface Props {
  showPoll: boolean
  showSchedule: boolean
  showTitle: boolean
  showBirthday: boolean
  showTheme: boolean
  onClose: () => void
  onCreatePoll: (q: string, opts: string[]) => void
  onSchedule: (text: string, minutes: number) => void
  onSaveTitle: (title: string) => void
  onSaveBirthday: (mmdd: string) => void
  onSetTheme: (accent: string) => void
  roomThemes: readonly { id: string; label: string; color: string }[]
}

export function FeatureModals({
  showPoll, showSchedule, showTitle, showBirthday, showTheme,
  onClose, onCreatePoll, onSchedule, onSaveTitle, onSaveBirthday, onSetTheme, roomThemes,
}: Props) {
  const [pollQ, setPollQ] = useState('')
  const [pollO1, setPollO1] = useState('')
  const [pollO2, setPollO2] = useState('')
  const [schedText, setSchedText] = useState('')
  const [schedMin, setSchedMin] = useState('5')
  const [customTitle, setCustomTitle] = useState('')
  const [birthday, setBirthday] = useState('')

  if (!showPoll && !showSchedule && !showTitle && !showBirthday && !showTheme) return null

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
        {showTitle && (
          <>
            <h3 className="font-bold mb-3">🎖️ 칭호 장착</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_TITLES.map((t) => (
                <button key={t} type="button" onClick={() => setCustomTitle(t)} className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-xs font-semibold">{t}</button>
              ))}
            </div>
            <input className="input-field w-full mb-3" placeholder="칭호 (12자)" maxLength={12} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />
            <button type="button" className="btn w-full" onClick={() => { onSaveTitle(customTitle); onClose() }}>장착</button>
          </>
        )}
        {showBirthday && (
          <>
            <h3 className="font-bold mb-3">🎂 생일 등록</h3>
            <input className="input-field w-full mb-3" placeholder="MM-DD (예: 03-15)" value={birthday} onChange={(e) => setBirthday(e.target.value)} maxLength={5} />
            <button type="button" className="btn w-full" onClick={() => { onSaveBirthday(birthday); onClose() }}>저장</button>
          </>
        )}
        {showTheme && (
          <>
            <h3 className="font-bold mb-3">🎨 방 테마 (상사, 1시간)</h3>
            <div className="grid grid-cols-3 gap-2">
              {roomThemes.map((t) => (
                <button key={t.id} type="button" onClick={() => { onSetTheme(t.color); onClose() }} className="py-3 rounded-xl text-white text-xs font-bold" style={{ background: t.color }}>{t.label}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function ChatFeatureBar({ onPoll, onSchedule, onRebellion }: {
  onPoll: () => void
  onSchedule: () => void
  onRebellion: () => void
}) {
  return (
    <div className="flex gap-1 px-3 pt-1.5 overflow-x-auto scrollbar-hide">
      <button type="button" onClick={onPoll} className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]">📊 투표</button>
      <button type="button" onClick={onSchedule} className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]">⏰ 예약</button>
      <button type="button" onClick={onRebellion} className="shrink-0 px-2.5 py-1 rounded-full bg-[var(--surface-2)] text-[11px] font-semibold text-[var(--text-secondary)]">⚡ 이병반란</button>
    </div>
  )
}
