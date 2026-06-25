export interface RankTier {
  min: number
  name: string
  /** @deprecated 표시는 RankInsignia 컴포넌트 사용 */
  emoji: string
}

export const RANK_TIERS: RankTier[] = [
  { min: 0, name: '이병', emoji: '▮' },
  { min: 50, name: '일병', emoji: '▮▮' },
  { min: 150, name: '상병', emoji: '▮▮▮' },
  { min: 350, name: '병장', emoji: '▮▮▮▮' },
  { min: 700, name: '하사', emoji: '◢' },
  { min: 1200, name: '중사', emoji: '◢◢' },
  { min: 2000, name: '상사', emoji: '◢◢◢' },
]

export const POINTS = {
  MISSION: 10,
  MISSION_DAILY_BONUS: 20,
  MESSAGE: 1,
  MESSAGE_DAILY_CAP: 20,
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
  return `${rank.name}`
}

/** 이병~병장: 가로 짝대기 1~4개, 하사~상사: 역V형 계급장 */
export function getRankInsigniaProps(points: number): { type: 'bars' | 'chevrons'; count: number } {
  const level = getRankLevel(points)
  if (level <= 3) return { type: 'bars', count: level + 1 }
  return { type: 'chevrons', count: level - 3 }
}

export function getRankLevel(points: number): number {
  let level = 0
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (points >= RANK_TIERS[i].min) level = i
  }
  return level
}

export const BASE_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const

export interface RankPerks {
  level: number
  tier: RankTier
  bonusReactions: string[]
  perkLabels: string[]
}

export function getRankPerks(points: number): RankPerks {
  const level = getRankLevel(points)
  const tier = getRankFromPoints(points)
  const bonusReactions: string[] = []
  const perkLabels: string[] = ['채팅 계급 뱃지']

  if (level >= 2) perkLabels.push('프로필 테두리 강조')
  if (level >= 4) {
    bonusReactions.push('💎')
    perkLabels.push('특수 반응 💎')
  }
  if (level >= 5) {
    bonusReactions.push('✨')
    perkLabels.push('골드 말풍선')
  }
  if (level >= 6) {
    bonusReactions.push('🎖️')
    perkLabels.push('엘리트 말풍선 · 반응 🎖️')
  }

  return {
    level,
    tier,
    bonusReactions,
    perkLabels,
  }
}

export function getAvailableReactions(points: number): string[] {
  const { bonusReactions } = getRankPerks(points)
  return [...BASE_REACTIONS, ...bonusReactions]
}

export function getRankBubbleClass(points: number, isMine: boolean): string {
  const level = getRankLevel(points)
  if (isMine) {
    if (level >= 6) return 'chat-bubble-mine chat-bubble-mine-officer'
    if (level >= 5) return 'chat-bubble-mine chat-bubble-mine-elite'
    if (level >= 4) return 'chat-bubble-mine chat-bubble-mine-gold'
    if (level >= 3) return 'chat-bubble-mine chat-bubble-mine-silver'
    return 'chat-bubble-mine'
  }
  if (level >= 6) return 'chat-bubble-other chat-bubble-other-officer'
  if (level >= 5) return 'chat-bubble-other chat-bubble-other-elite'
  if (level >= 4) return 'chat-bubble-other chat-bubble-other-gold'
  if (level >= 3) return 'chat-bubble-other chat-bubble-other-silver'
  if (level >= 2) return 'chat-bubble-other chat-bubble-other-copper'
  return 'chat-bubble-other'
}

export function getRankAvatarClass(points: number): string {
  const level = getRankLevel(points)
  return `rank-avatar rank-avatar-${level}`
}

export function getRankBadgeClass(points: number): string {
  const level = getRankLevel(points)
  return `rank-badge rank-badge-${level}`
}

export const TIER_PERK_SUMMARY: Record<string, string[]> = {
  '이병': ['채팅 계급 뱃지'],
  '일병': ['채팅 계급 뱃지'],
  '상병': ['채팅 계급 뱃지', '프로필 테두리 강조'],
  '병장': ['실버 말풍선'],
  '하사': ['특수 반응 💎', '골드 말풍선'],
  '중사': ['특수 반응 💎✨', '골드 말풍선'],
  '상사': ['특수 반응 💎✨🎖️', '엘리트 말풍선'],
}
