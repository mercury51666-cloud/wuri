import { useEffect, useState } from 'react'
import { getToken } from 'firebase/messaging'
import { doc, setDoc, arrayUnion } from 'firebase/firestore'
import { messagingPromise, db } from '../firebase'

export function useFCMToken(uid: string | undefined) {
  const [token, setToken] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    setPermission(Notification.permission)
  }, [])

  const requestPermission = async () => {
    if (!uid) return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return

      const messaging = await messagingPromise
      if (!messaging) return

      const fcmToken = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      })

      if (fcmToken) {
        setToken(fcmToken)
        await setDoc(doc(db, 'users', uid), {
          fcmTokens: arrayUnion(fcmToken),
        }, { merge: true })
      }
    } catch (e) {
      console.warn('FCM token error:', e)
    }
  }

  useEffect(() => {
    if (uid && Notification.permission === 'granted') {
      requestPermission()
    }
  }, [uid])

  return { token, permission, requestPermission }
}
