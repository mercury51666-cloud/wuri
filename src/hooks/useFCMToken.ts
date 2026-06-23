import { useEffect, useState } from 'react'
import { getToken } from 'firebase/messaging'
import { doc, setDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'
import { messagingPromise, db } from '../firebase'

const NOTIF_KEY = 'wuri_notif_enabled'

export function useFCMToken(uid: string | undefined) {
  const [token, setToken] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState(() => localStorage.getItem(NOTIF_KEY) === '1')

  useEffect(() => {
    setPermission(Notification.permission)
  }, [])

  const getFCMToken = async (): Promise<string | null> => {
    const messaging = await messagingPromise
    if (!messaging) return null
    try {
      return await getToken(messaging, { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY })
    } catch {
      return null
    }
  }

  const enableNotifications = async () => {
    if (!uid) return
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      if (result !== 'granted') return

      const fcmToken = await getFCMToken()
      if (fcmToken) {
        setToken(fcmToken)
        await setDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(fcmToken) }, { merge: true })
        localStorage.setItem(NOTIF_KEY, '1')
        setEnabled(true)
      }
    } catch (e) {
      console.warn('FCM enable error:', e)
    }
  }

  const disableNotifications = async () => {
    if (!uid) return
    try {
      const fcmToken = token ?? await getFCMToken()
      if (fcmToken) {
        const ref = doc(db, 'users', uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          await setDoc(ref, { fcmTokens: arrayRemove(fcmToken) }, { merge: true })
        }
      }
      localStorage.removeItem(NOTIF_KEY)
      setEnabled(false)
      setToken(null)
    } catch (e) {
      console.warn('FCM disable error:', e)
    }
  }

  useEffect(() => {
    if (uid && Notification.permission === 'granted' && enabled) {
      getFCMToken().then((t) => { if (t) setToken(t) })
    }
  }, [uid])

  return { token, permission, enabled, enableNotifications, disableNotifications }
}
