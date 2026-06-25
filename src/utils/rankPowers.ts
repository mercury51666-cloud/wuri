import { getRankFromPoints, getRankLevel } from './rankSystem'

export const MUTE_DURATION_MS = 10_000
export const MUTE_COOLDOWN_MS = 60_000
export const SALUTE_COOLDOWN_MS = 30_000

export interface RoomMute {
  byUserId: string
  byUserName: string
  byRankName: string
  until: number
}

export function compareRankLevel(actorPoints: number, targetPoints: number): number {
  return getRankLevel(actorPoints) - getRankLevel(targetPoints)
}

/** 계급이 strictly 높을 때만 */
export function canMute(actorPoints: number, targetPoints: number): boolean {
  return compareRankLevel(actorPoints, targetPoints) > 0
}

/** 계급이 더 낮거나, 같은 계급이면 점수가 더 낮을 때 */
export function canSalute(actorPoints: number, targetPoints: number): boolean {
  if (actorPoints === targetPoints) return false
  const levelDiff = compareRankLevel(actorPoints, targetPoints)
  if (levelDiff < 0) return true
  if (levelDiff === 0 && targetPoints > actorPoints) return true
  return false
}

export function buildMuteEventText(
  actorName: string,
  actorRankName: string,
  targetName: string,
): string {
  return `${actorName} ${actorRankName}님이 ${targetName}님을 10초간 벙어리 처리! 🤐`
}

export function buildSaluteEventText(
  actorName: string,
  actorRankName: string,
  targetName: string,
  targetRankName: string,
): string {
  return `${actorName} ${actorRankName} → ${targetName} ${targetRankName}님께 경례! 🫡`
}

export function getRankName(points: number): string {
  return getRankFromPoints(points).name
}

export const RANK_FUN_POWERS = [
  {
    icon: '🤐',
    title: '벙어리 10초',
    desc: '내 계급이 더 높으면 상대 채팅을 10초간 막을 수 있어요 (1분 쿨타임)',
  },
  {
    icon: '🫡',
    title: '경례',
    desc: '내 계급·점수가 더 낮으면 상급에게 경례 메시지를 보낼 수 있어요 (30초 쿨타임)',
  },
  {
    icon: '📌',
    title: '공지 고정',
    desc: '병장 이상은 메시지를 공지로 고정할 수 있어요',
  },
] as const
