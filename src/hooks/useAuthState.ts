import { useState, useEffect } from 'react'
import { onAuthStateChanged, getRedirectResult, type User } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const init = async () => {
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
