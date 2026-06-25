import { getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, messagingPromise } from '../firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

function tokenDocId(token: string) {
  return token.slice(-48).replace(/[/+=]/g, '_')
}

async function ensureMessagingServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  const existing = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
  if (existing) return existing
  return navigator.serviceWorker.register('/firebase-messaging-sw.js')
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && !!VAPID_KEY
}

export async function setupPushNotifications(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false

  const messaging = await messagingPromise
  if (!messaging) return false

  if (Notification.permission === 'denied') return false
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission()
    if (result !== 'granted') return false
  }

  const registration = await ensureMessagingServiceWorker()
  if (!registration) return false
  await navigator.serviceWorker.ready

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  if (!token) return false

  await setDoc(doc(db, 'users', userId, 'fcmTokens', tokenDocId(token)), {
    token,
    updatedAt: serverTimestamp(),
  }, { merge: true })

  onMessage(messaging, (payload) => {
    if (Notification.permission !== 'granted' || !document.hidden) return
    const title = payload.notification?.title ?? 'WURI'
    const body = payload.notification?.body ?? ''
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      data: payload.data,
    })
  })

  return true
}

export async function requestPushNotifications(userId: string) {
  return setupPushNotifications(userId)
}
