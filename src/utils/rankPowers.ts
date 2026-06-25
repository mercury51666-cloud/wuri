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

/** member가 viewer보다 상급인지 (경례 대상과 동일) */
export function isSuperior(memberPoints: number, viewerPoints: number): boolean {
  return canSalute(viewerPoints, memberPoints)
}

/** 상급 이름에 자동으로 님 붙이기 */
export function formatRankHonorificName(
  name: string,
  memberPoints: number,
  viewerPoints: number,
): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.endsWith('님')) return trimmed || name
  if (!isSuperior(memberPoints, viewerPoints)) return trimmed
  return `${trimmed}님`
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
  {
    icon: '🎖️',
    title: '계급 호출',
    desc: '채팅·멤버 목록에서 상급 이름에 자동으로 님이 붙어요',
  },
  { icon: '🏆', title: '계급전', desc: '주간 1등 명예의 전당 + 배너' },
  { icon: '⚡', title: '이병 반란', desc: '최하위 계급 하루 1번 전원 3초 벙어리' },
  { icon: '🎉', title: '임관식', desc: '승진 시 채팅 축하 이벤트' },
  { icon: '👑', title: '오늘의 MVP', desc: '어제 활동 1등 배너' },
  { icon: '🔥', title: '연속 출석', desc: '매일 접속 streak 보너스' },
  { icon: '🎨', title: '방 테마', desc: '상사 1시간 accent 변경' },
  { icon: '🎯', title: '단체 미션', desc: '주간 미션 10개 달성 보너스' },
  { icon: '🎂', title: '생일', desc: '생일 등록 시 배너' },
  { icon: '@', title: '멘션', desc: '@이름 으로 호출' },
  { icon: '📊', title: '투표', desc: '병장 이상 2표' },
  { icon: '📭', title: '읽씹 알림', desc: '30분 미확인 시 알림' },
  { icon: '⏰', title: '예약 메시지', desc: '앱 켜져 있을 때 자동 전송' },
  { icon: '🏷️', title: '칭호', desc: '프로필에서 칭호 장착' },
] as const
