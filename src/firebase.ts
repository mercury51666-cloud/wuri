import { getApps, initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  )
}

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)

function createAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  } catch {
    return getAuth(app)
  }
}

export const auth = createAuth()

// 폰이 오래 대기 상태였다가 돌아오면 기본 WebChannel 연결이 끊긴 채로 안 살아나서
// 메시지 전송이 실패하는 경우가 있다 — long polling을 자동 감지해 쓰면 훨씬 안정적으로 재연결된다.
function createDb() {
  try {
    return initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
  } catch {
    return getFirestore(app)
  }
}

export const db = createDb()
export const storage = getStorage(app)

export function getFirebaseDebugLabel() {
  if (!isFirebaseConfigured()) return 'Firebase 미설정'
  return `${firebaseConfig.projectId} · ${firebaseConfig.authDomain}`
}
