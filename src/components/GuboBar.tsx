import type { GuboPending } from '../hooks/useRoomExtras'

interface Props {
  pending: GuboPending
  onGubo: () => void
  onDismiss: () => void
}

export default function GuboBar({ pending, onGubo, onDismiss }: Props) {
  return (
    <div className="px-4 py-2 flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-100 dark:border-amber-500/20">
      <p className="flex-1 text-xs text-amber-800 dark:text-amber-300">
        {pending.byUserName} {pending.byRankName}님께 구보!
      </p>
      <button type="button" onClick={onGubo} className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold active:scale-95">
        🫡 구보
      </button>
      <button type="button" onClick={onDismiss} className="text-amber-600/60 text-lg px-1">✕</button>
    </div>
  )
}
