import { getRankBadgeClass } from '../utils/rankSystem'
import type { RoomRankData } from '../utils/roomPoints'
import RankInsignia from './RankInsignia'

interface Props {
  rank: Pick<RoomRankData, 'rankName' | 'points' | 'equippedTitle'>
  size?: 'sm' | 'md'
}

export default function RankBadge({ rank, size = 'sm' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-bold shrink-0 ${getRankBadgeClass(rank.points)} ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5 rounded-md' : 'text-xs px-2 py-1 rounded-lg'
      }`}
    >
      <RankInsignia points={rank.points} size={size} />
      <span>{rank.rankName}{rank.equippedTitle ? ` · ${rank.equippedTitle}` : ''}</span>
    </span>
  )
}
