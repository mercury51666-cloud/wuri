import { useState, useEffect } from 'react'
import {
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  type User,
} from 'firebase/auth'
import { auth } from '../firebase'
import { clearAuthRedirectPending, isAuthRedirectPending } from '../utils/inviteStorage'

let redirectBootstrap: Promise<User | null> | null = null

function bootstrapRedirectResult() {
  if (!redirectBootstrap) {
    redirectBootstrap = (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        /* persistence may already be set */
      }
      try {
        const result = await getRedirectResult(auth)
        return result?.user ?? null
      } finally {
        clearAuthRedirectPending()
      }
    })()
  }
  return redirectBootstrap
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | undefined

    const init = async () => {
      const redirectPending = isAuthRedirectPending()

      try {
        const redirectUser = await bootstrapRedirectResult()
        if (!cancelled && redirectUser) {
          setUser(redirectUser)
        }
      } catch (err) {
        console.error('Redirect sign-in failed', err)
        if (!cancelled) {
          setAuthError('Google 로그인 처리에 실패했어요. 다시 시도해주세요.')
        }
      }

      if (cancelled) return

      unsub = onAuthStateChanged(auth, (currentUser) => {
        if (cancelled) return
        setUser(currentUser)
        setLoading(false)
      })

      // OAuth 복귀 직후엔 auth 이벤트가 늦을 수 있음 — 너무 빨리 로그인 화면 노출 방지
      const fallbackMs = redirectPending ? 12000 : 8000
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
