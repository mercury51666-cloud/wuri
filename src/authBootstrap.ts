import { getRedirectResult } from 'firebase/auth'
import { auth } from './firebase'
import { clearAuthRedirectPending } from './utils/inviteStorage'
import { formatAuthError, isOAuthReturnUrl, oauthReturnFailureMessage } from './utils/authErrors'

export let authRedirectError: string | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(fallback)
      }
    }, ms)
    promise.then(
      (value) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(value)
        }
      },
      () => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve(fallback)
        }
      },
    )
  })
}

async function clearServiceWorkersForOAuthReturn() {
  if (!isOAuthReturnUrl() || !('serviceWorker' in navigator)) return
  try {
    const regs = await withTimeout(navigator.serviceWorker.getRegistrations(), 1500, [])
    await withTimeout(
      Promise.all(regs.map((reg) => reg.unregister().catch(() => false))),
      1500,
      [],
    )
  } catch {
    /* ignore */
  }
}

async function handleRedirectResult() {
  await clearServiceWorkersForOAuthReturn()
  let signedIn = false

  try {
    const result = await withTimeout(getRedirectResult(auth), 8000, null)
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

/** 어떤 경우에도 이 프라미스는 멈추지 않고 정해진 시간 안에 끝남 */
export const authRedirectPromise = handleRedirectResult()
