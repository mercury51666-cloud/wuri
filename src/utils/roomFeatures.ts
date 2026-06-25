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

export const READ_NUDGE_MS = 30 * 60 * 1000

export function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function birthdayKey(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
