import { useState, useEffect } from 'react'
import { onAuthStateChanged, getRedirectResult, type User } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const init = async () => {
      // redirect 로그인 완료를 먼저 기다린 뒤 auth 상태 구독
      try {
        await getRedirectResult(auth)
      } catch {
        // 무시
      }
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser)
        setLoading(false)
      })
    }

    init()
    return () => { unsubscribe?.() }
  }, [])

  return { user, loading }
}
