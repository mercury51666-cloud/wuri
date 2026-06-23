import { useState, useEffect } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../firebase'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 5초 안에 auth 상태가 안 오면 강제로 로딩 종료 (모바일 Safari 대비)
    const timeout = setTimeout(() => setLoading(false), 5000)

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      clearTimeout(timeout)
      setUser(currentUser)
      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  return { user, loading }
}
