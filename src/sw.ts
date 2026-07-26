// @ts-nocheck
/* eslint-disable */
// 워크박스 프리캐싱 + Firebase Cloud Messaging 백그라운드 푸시를
// 하나의 서비스워커에서 함께 처리한다. (앱을 나가거나 종료해도 알림이 오도록)
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

precacheAndRoute(self.__WB_MANIFEST)

// OAuth 복귀 URL(?apiKey=...)은 SW가 가로채지 않도록 내비게이션 폴백에서 제외
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [
      /^\/__/,
      /\/__\/auth/,
      /[?&](apiKey|authType|authUser|code|state|error|mode|oobCode)=/,
    ],
  }),
)

// --- Firebase Cloud Messaging ---
// importScripts가 실패해도(네트워크 오류 등) 워크박스 프리캐싱은 절대 깨지면 안 되므로
// 반드시 try/catch로 감싼다. 여길 감싸지 않으면 SW 전체 설치가 실패해서
// navigator.serviceWorker.ready가 영원히 대기하는 심각한 문제가 생긴다.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js')

  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }

  if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
    firebase.initializeApp(firebaseConfig)
    const messaging = firebase.messaging()

    messaging.onBackgroundMessage((payload) => {
      const title = payload.data?.title ?? 'WURI'
      const body = payload.data?.body ?? '새 메시지가 있어요'
      const url = payload.data?.url ?? '/'
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url },
      })
    })
  }
} catch (err) {
  console.error('[WURI sw] FCM init failed', err)
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(url))
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    }),
  )
})
