import RankBadge from './RankBadge'
import { getRankFromPoints } from '../utils/rankSystem'
import type { RoomRankData } from '../utils/roomPoints'

interface Props {
  memberIds: string[]
  memberProfiles: Record<string, { displayName: string; photoURL?: string | null }>
  memberRanks: Record<string, RoomRankData>
  onMemberClick: (name: string, photoURL?: string, userId?: string) => void
}

function getDisplayRank(uid: string, name: string, ranks: Record<string, RoomRankData>): RoomRankData {
  if (ranks[uid]) return ranks[uid]
  const tier = getRankFromPoints(0)
  return {
    userId: uid,
    userName: name,
    points: 0,
    rankName: tier.name,
    rankEmoji: tier.emoji,
    weeklyMissions: 0,
    weeklyMessages: 0,
    weekKey: '',
    todayMessageCount: 0,
    todayDate: '',
    missionBonusDates: [],
  }
}

export default function ChatMemberRanks({ memberIds, memberProfiles, memberRanks, onMemberClick }: Props) {
  const sorted = [...memberIds].sort((a, b) => {
    const pa = memberRanks[a]?.points ?? 0
    const pb = memberRanks[b]?.points ?? 0
    return pb - pa
  })

  return (
    <div className="mx-4 mt-2 mb-1 shrink-0">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {sorted.map((uid) => {
          const profile = memberProfiles[uid]
          const name = profile?.displayName ?? '...'
          const rank = getDisplayRank(uid, name, memberRanks)
          return (
            <button
              key={uid}
              type="button"
              onClick={() => onMemberClick(name, profile?.photoURL ?? undefined, uid)}
              className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] active:scale-95 transition-transform"
            >
              <div className="w-5 h-5 rounded-full overflow-hidden bg-[var(--brand-soft)] shrink-0">
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                  : <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-[var(--brand)]">{name[0]}</span>
                }
              </div>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)] max-w-[4rem] truncate">{name}</span>
              <RankBadge rank={rank} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
