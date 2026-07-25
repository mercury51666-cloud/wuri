import { useState, useEffect } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { authRedirectError, authRedirectPromise } from '../authBootstrap'
import { auth } from '../firebase'
import { isAuthRedirectPending } from '../utils/inviteStorage'
import { parseAuthUrlError } from '../utils/authErrors'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(
    () => authRedirectError || parseAuthUrlError(),
  )

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    const init = async () => {
      const redirectPending = isAuthRedirectPending()

      try {
        const result = await authRedirectPromise
        if (!cancelled && result?.user) {
          setUser(result.user)
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

      const fallbackMs = redirectPending ? 15000 : 6000
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
