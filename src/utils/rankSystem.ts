export interface RankTier {
  min: number
  name: string
  emoji: string
}

export const RANK_TIERS: RankTier[] = [
  { min: 0, name: '이병', emoji: '🪖' },
  { min: 50, name: '일병', emoji: '⭐' },
  { min: 150, name: '상병', emoji: '🔥' },
  { min: 350, name: '병장', emoji: '👑' },
  { min: 700, name: '하사', emoji: '🎖️' },
  { min: 1200, name: '중사', emoji: '🏆' },
  { min: 2000, name: '상사', emoji: '⚔️' },
]

export const POINTS = {
  MISSION: 10,
  MISSION_DAILY_BONUS: 20,
  MESSAGE: 1,
  MESSAGE_DAILY_CAP: 20,
  WEEKLY_MISSION_TOP: 50,
  WEEKLY_CHAT_TOP: 30,
} as const

export function getRankFromPoints(points: number): RankTier {
  let tier = RANK_TIERS[0]
  for (const t of RANK_TIERS) {
    if (points >= t.min) tier = t
  }
  return tier
}

export function getNextRank(points: number): RankTier | null {
  return RANK_TIERS.find((t) => t.min > points) ?? null
}

export function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function getPreviousWeekKey(weekKey: string): string | null {
  const [yearStr, weekStr] = weekKey.split('-W')
  let year = Number(yearStr)
  let week = Number(weekStr) - 1
  if (week < 1) {
    year -= 1
    week = 52
  }
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function formatRankLabel(points: number): string {
  const rank = getRankFromPoints(points)
  return `${rank.emoji} ${rank.name}`
}
