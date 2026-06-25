import type { RoomRankData } from './roomPoints'
import { getRankLevel } from './rankSystem'

export const PRESET_TITLES = [
  '밥먹는', '늦잡', '게임하는', '운동하는', '노래하는', '채팅왕', '미션왕', '분위기메이커',
] as const

export const ROOM_THEMES = [
  { id: 'violet', label: '보라', color: '#7c3aed' },
  { id: 'emerald', label: '초록', color: '#059669' },
  { id: 'rose', label: '장미', color: '#e11d48' },
  { id: 'amber', label: '골드', color: '#d97706' },
  { id: 'sky', label: '하늘', color: '#0284c7' },
] as const

export const GROUP_MISSION_GOAL = 10
export const READ_NUDGE_MS = 30 * 60 * 1000

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function birthdayKey(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function computeDailyMvp(ranks: Record<string, RoomRankData>) {
  let best: { userId: string; userName: string; score: number } | null = null
  for (const r of Object.values(ranks)) {
    const score = r.todayMessageCount + r.weeklyMissions
    if (!best || score > best.score) {
      best = { userId: r.userId, userName: r.userName, score }
    }
  }
  return best && best.score > 0 ? best : null
}

export function findLowestRankMembers(
  memberIds: string[],
  ranks: Record<string, RoomRankData>,
): string[] {
  let minLevel = Infinity
  for (const uid of memberIds) {
    const level = getRankLevel(ranks[uid]?.points ?? 0)
    if (level < minLevel) minLevel = level
  }
  return memberIds.filter((uid) => getRankLevel(ranks[uid]?.points ?? 0) === minLevel)
}

export function hasSuperiorInRoom(memberIds: string[], ranks: Record<string, RoomRankData>, minLevel = 6) {
  return memberIds.some((uid) => getRankLevel(ranks[uid]?.points ?? 0) >= minLevel)
}
