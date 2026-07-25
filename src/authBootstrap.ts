import { getRedirectResult } from 'firebase/auth'
import { auth } from './firebase'
import { clearAuthRedirectPending } from './utils/inviteStorage'
import { formatAuthError } from './utils/authErrors'

/** OAuth 리다이렉트 복귀 시 React 렌더 전에 한 번만 실행 */
export let authRedirectError: string | null = null

export const authRedirectPromise = getRedirectResult(auth)
  .catch((err) => {
    authRedirectError = formatAuthError(err)
    console.error('[WURI auth] getRedirectResult failed', err)
    return null
  })
  .finally(() => {
    clearAuthRedirectPending()
  })
