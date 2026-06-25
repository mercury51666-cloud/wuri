import { getRankBadgeClass } from '../utils/rankSystem'
import type { RoomRankData } from '../utils/roomPoints'

interface Props {
  rank: Pick<RoomRankData, 'rankEmoji' | 'rankName' | 'points'>
  size?: 'sm' | 'md'
}

export default function RankBadge({ rank, size = 'sm' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-bold shrink-0 ${getRankBadgeClass(rank.points)} ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5 rounded-md' : 'text-xs px-2 py-1 rounded-lg'
      }`}
    >
      <span>{rank.rankEmoji}</span>
      <span>{rank.rankName}</span>
    </span>
  )
}
