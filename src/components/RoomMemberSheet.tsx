import { Users, X } from 'lucide-react'
import RankBadge from './RankBadge'
import type { RoomRankData } from '../utils/roomPoints'
import { formatRankHonorificName } from '../utils/rankPowers'

interface Props {
  memberIds: string[]
  memberProfiles: Record<string, { displayName: string; photoURL?: string | null }>
  memberRanks: Record<string, RoomRankData>
  viewerPoints: number
  onClose: () => void
  onViewProfile: (name: string, photoURL?: string, userId?: string) => void
}

export default function RoomMemberSheet({
  memberIds,
  memberProfiles,
  memberRanks,
  viewerPoints,
  onClose,
  onViewProfile,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet sheet-enter max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <p className="font-bold text-[var(--text)] flex items-center gap-2">
            <Users size={18} />
            멤버 {memberIds.length}명
          </p>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="닫기">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto divide-y divide-[var(--border)]">
          {memberIds.map((uid) => {
            const profile = memberProfiles[uid]
            const rank = memberRanks[uid]
            const rawName = profile?.displayName ?? '...'
            const displayName = formatRankHonorificName(rawName, rank?.points ?? 0, viewerPoints)
            return (
              <button
                key={uid}
                type="button"
                onClick={() => {
                  onViewProfile(rawName, profile?.photoURL ?? undefined, uid)
                  onClose()
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--brand-soft)] shrink-0">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--brand)]">
                      {rawName[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">{displayName}</p>
                  {rank ? (
                    <RankBadge rank={rank} />
                  ) : (
                    <RankBadge rank={{ rankName: '이병', points: 0 }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
