/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'

declare const self: ServiceWorkerGlobalScope

// 새 서비스 워커가 설치되면 즉시 활성화 (대기 없이)
self.addEventListener('install', () => {
  self.skipWaiting()
})

// 활성화 즉시 모든 클라이언트 제어권 획득 + 오래된 캐시 전부 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  )
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

try {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  const app = initializeApp(firebaseConfig)
  const messaging = getMessaging(app)

  onBackgroundMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? 'WURI'
    const body = payload.notification?.body ?? '새 메시지가 도착했어요'
    const roomId = payload.data?.roomId ?? ''

    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: roomId,
      data: { url: `/room/${roomId}` },
    } as NotificationOptions)
  })
} catch (e) {
  console.warn('[SW] Firebase init skipped:', e)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const match = clients.find((c) => c.url.includes(url))
      if (match) return match.focus()
      return self.clients.openWindow(url)
    })
  )
})
