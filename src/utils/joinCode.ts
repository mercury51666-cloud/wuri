const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateJoinCode(length = 6): string {
  let code = ''
  let hasLetter = false
  let hasDigit = false
  while (!hasLetter || !hasDigit) {
    code = ''
    hasLetter = false
    hasDigit = false
    for (let i = 0; i < length; i++) {
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)]
      code += ch
      if (/[A-Z]/.test(ch)) hasLetter = true
      if (/[0-9]/.test(ch)) hasDigit = true
    }
  }
  return code
}

export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s/g, '')
}

export function isValidJoinCodeFormat(code: string): boolean {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return false
  return /[A-Z]/.test(code) && /[0-9]/.test(code)
}
