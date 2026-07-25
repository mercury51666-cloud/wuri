import { getRedirectResult } from 'firebase/auth'
import { auth } from './firebase'
import { clearAuthRedirectPending } from './utils/inviteStorage'
import { formatAuthError, isOAuthReturnUrl, oauthReturnFailureMessage } from './utils/authErrors'

export let authRedirectError: string | null = null

async function clearServiceWorkersForOAuthReturn() {
  if (!isOAuthReturnUrl() || !('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((reg) => reg.unregister()))
  } catch {
    /* ignore */
  }
}

async function handleRedirectResult() {
  await clearServiceWorkersForOAuthReturn()
  let signedIn = false

  try {
    const result = await getRedirectResult(auth)
    signedIn = Boolean(result?.user || auth.currentUser)
    if (result?.user) return result

    if (isOAuthReturnUrl() && !auth.currentUser) {
      authRedirectError = oauthReturnFailureMessage()
    }
    return result
  } catch (err) {
    authRedirectError = formatAuthError(err)
    console.error('[WURI auth] getRedirectResult failed', err)
    return null
  } finally {
    clearAuthRedirectPending()
    if (isOAuthReturnUrl() && signedIn) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }
}

/** React 렌더 전에 반드시 await */
export const authRedirectPromise = handleRedirectResult()
