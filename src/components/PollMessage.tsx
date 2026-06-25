
interface Props {
  question: string
  options: string[]
  votes: Record<string, string[]>
  myUid?: string
  onVote: (optionIdx: number) => void
}

export default function PollMessage({ question, options, votes, myUid, onVote }: Props) {
  const counts = options.map((_, i) => (votes[String(i)] ?? []).length)
  const total = counts.reduce((a, b) => a + b, 0) || 1
  const myChoice = myUid && votes
    ? Object.entries(votes).find(([, uids]) => uids.includes(myUid))?.[0]
    : undefined

  return (
    <div className="poll-card card-flat p-3 max-w-[85%]">
      <p className="text-sm font-bold text-[var(--text)] mb-2">📊 {question}</p>
      <p className="text-[10px] text-[var(--text-muted)] mb-2">탭해서 투표</p>
      <div className="space-y-1.5">
        {options.map((opt, i) => {
          const pct = Math.round((counts[i] / total) * 100)
          const selected = myChoice === String(i)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onVote(i)}
              className={`poll-option w-full text-left relative overflow-hidden rounded-lg px-3 py-2 text-xs border transition-all active:scale-[0.98] ${
                selected ? 'border-[var(--brand)] bg-[var(--brand-soft)]' : 'border-[var(--border)]'
              }`}
            >
              <div className="poll-bar absolute inset-y-0 left-0 bg-[var(--brand)]/15" style={{ width: `${pct}%` }} />
              <span className="relative flex justify-between gap-2">
                <span className="font-medium text-[var(--text)]">{opt}</span>
                <span className="text-[var(--text-muted)] tabular-nums">{counts[i]}표 ({pct}%)</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
