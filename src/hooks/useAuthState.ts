import { useState, useEffect } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { authRedirectError, authRedirectPromise } from '../authBootstrap'
import { auth } from '../firebase'
import { isAuthRedirectPending } from '../utils/inviteStorage'
import { isOAuthReturnUrl, oauthReturnFailureMessage, parseAuthUrlError } from '../utils/authErrors'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(() => auth.currentUser)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(
    () => authRedirectError || parseAuthUrlError(),
  )

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    const init = async () => {
      const redirectPending = isAuthRedirectPending() || isOAuthReturnUrl()

      try {
        await authRedirectPromise
        if (!cancelled && auth.currentUser) {
          setUser(auth.currentUser)
        } else if (!cancelled && isOAuthReturnUrl() && !auth.currentUser && !authRedirectError) {
          setAuthError(oauthReturnFailureMessage())
        }
      } catch {
        /* handled in authBootstrap */
      }

      if (cancelled) return

      unsub = onAuthStateChanged(auth, (currentUser) => {
        if (cancelled) return
        setUser(currentUser)
        setLoading(false)
        if (currentUser) setAuthError(null)
      })

      if (auth.currentUser) {
        setUser(auth.currentUser)
        setLoading(false)
      }

      const fallbackMs = redirectPending ? 15000 : 4000
      window.setTimeout(() => {
        if (!cancelled) setLoading(false)
      }, fallbackMs)
    }

    init()

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  return { user, loading, authError, clearAuthError: () => setAuthError(null) }
}
