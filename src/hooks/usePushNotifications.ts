import { useEffect } from 'react'
import type { User } from 'firebase/auth'
import { setupPushNotifications } from '../utils/pushNotifications'

export function usePushNotifications(user: User | null) {
  useEffect(() => {
    if (!user) return
    if (Notification.permission === 'denied') return
    setupPushNotifications(user.uid).catch(() => {})
  }, [user?.uid])
}
