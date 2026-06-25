import type { RoomMetaState } from '../hooks/useRoomExtras'

export default function HallOfFame({ entries }: { entries: RoomMetaState['hallOfFame'] }) {
  if (!entries.length) {
    return (
      <div className="card-flat p-6 text-center text-sm text-[var(--text-muted)]">
        아직 명예의 전당 기록이 없어요
      </div>
    )
  }
  const label = (type: string) =>
    type === 'mission' ? '🎯 미션 1등' : type === 'chat' ? '💬 채팅 1등' : '🏆 종합 1등'

  return (
    <div className="card-flat overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-bold text-sm text-[var(--text)]">🏛️ 명예의 전당</h3>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {entries.map((e, i) => (
          <div key={`${e.weekKey}-${e.type}-${i}`} className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)] truncate">{e.userName}</p>
              <p className="text-xs text-[var(--text-muted)]">{e.weekKey} · {label(e.type)}</p>
            </div>
            <span className="text-sm font-bold text-[var(--brand)] shrink-0">{e.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
