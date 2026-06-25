import { getRankInsigniaProps } from '../utils/rankSystem'

interface Props {
  points: number
  size?: 'sm' | 'md' | 'lg'
}

export default function RankInsignia({ points, size = 'sm' }: Props) {
  const { type, count } = getRankInsigniaProps(points)

  if (type === 'bars') {
    return (
      <span className={`rank-insignia rank-insignia-bars rank-insignia-${size}`} aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="rank-bar" />
        ))}
      </span>
    )
  }

  return (
    <span className={`rank-insignia rank-insignia-chevrons rank-insignia-${size}`} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="rank-chevron" />
      ))}
      {count >= 3 && <span className="rank-star" />}
    </span>
  )
}
