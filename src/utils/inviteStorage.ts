const INVITE_KEY = 'wuri_invite'
const REDIRECT_PENDING_KEY = 'wuri_auth_redirect_pending'

export function saveInvitePath(path: string) {
  try {
    localStorage.setItem(INVITE_KEY, path)
    sessionStorage.setItem(INVITE_KEY, path)
  } catch {
    /* storage blocked */
  }
}

export function consumeInvitePath(fallback = '/') {
  try {
    const from =
      localStorage.getItem(INVITE_KEY) ||
      sessionStorage.getItem(INVITE_KEY) ||
      fallback
    localStorage.removeItem(INVITE_KEY)
    sessionStorage.removeItem(INVITE_KEY)
    return from
  } catch {
    return fallback
  }
}

export function markAuthRedirectPending() {
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearAuthRedirectPending() {
  try {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export function isAuthRedirectPending() {
  try {
    return sessionStorage.getItem(REDIRECT_PENDING_KEY) === '1'
  } catch {
    return false
  }
}
