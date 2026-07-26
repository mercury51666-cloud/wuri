import { arrayRemove, arrayUnion, doc, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage, type Messaging } from 'firebase/messaging'
import { app, db, isFirebaseConfigured } from '../firebase'

let messagingInstance: Messaging | null | undefined

async function getMessagingInstance(): Promise<Messaging | null> {
  if (!isFirebaseConfigured()) return null
  if (messagingInstance !== undefined) return messagingInstance
  try {
    const supported = 'serviceWorker' in navigator && (await isSupported())
    messagingInstance = supported ? getMessaging(app) : null
  } catch {
    messagingInstance = null
  }
  return messagingInstance
}

/** 이 브라우저·환경에서 웹 푸시(앱을 나가도 오는 알림)를 지원하는지 여부.
 * iOS는 Safari에서 "홈 화면에 추가"한 PWA 상태에서만 지원한다. */
export async function isPushSupported(): Promise<boolean> {
  return Boolean(await getMessagingInstance())
}

/** 알림 권한 허용 후 FCM 토큰을 받아 내 유저 문서에 저장한다.
 * 토큰을 못 받으면(미지원 환경, VAPID 키 누락 등) null을 반환 — 이때는
 * 로컬 알림(앱이 열려 있을 때만 동작)으로 자연스럽게 대체된다. */
export async function registerFcmToken(uid: string): Promise<string | null> {
  try {
    const messaging = await getMessagingInstance()
    if (!messaging) return null
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
    if (!vapidKey) {
      console.warn('[WURI push] VITE_FIREBASE_VAPID_KEY가 설정되지 않았어요')
      return null
    }
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
    if (!token) return null
    await setDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) }, { merge: true })
    return token
  } catch (err) {
    console.error('[WURI push] 토큰 등록 실패', err)
    return null
  }
}

export async function unregisterFcmToken(uid: string, token: string) {
  try {
    await setDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) }, { merge: true })
  } catch {
    /* ignore */
  }
}

/** 앱이 열려 있는(포그라운드) 상태에서 오는 푸시를 받는다.
 * 데이터 전용 메시지라 브라우저가 자동으로 알림을 띄우지 않으므로,
 * 여기서 받은 걸 토스트 등으로 직접 보여줄 수 있다. */
export function listenForegroundPush(
  onPush: (payload: { title: string; body: string; url?: string }) => void,
): () => void {
  let unsub: (() => void) | undefined
  let cancelled = false
  getMessagingInstance().then((messaging) => {
    if (!messaging || cancelled) return
    unsub = onMessage(messaging, (payload) => {
      const title = payload.data?.title ?? payload.notification?.title ?? 'WURI'
      const body = payload.data?.body ?? payload.notification?.body ?? ''
      onPush({ title, body, url: payload.data?.url })
    })
  })
  return () => {
    cancelled = true
    unsub?.()
  }
}

/** 새 메시지가 저장된 뒤 서버(Vercel Function)에 푸시 전송을 요청한다.
 * 실패해도 채팅 자체에는 영향 없도록 항상 조용히 무시한다. */
export function requestMessagePush(payload: {
  roomId: string
  senderId: string
  senderName: string
  roomName?: string
  text?: string
  imageURL?: string
}) {
  fetch('/api/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {})
}
