export const READ_NUDGE_MS = 30 * 60 * 1000

export function birthdayKey(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
