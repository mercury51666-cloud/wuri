import { useEffect, useRef } from 'react'

const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window

export function useNotifications(roomName: string) {
  const notify = (authorName: string, message: string) => {
    if (!isNotificationSupported) return
    if (Notification.permission !== 'granted') return
    if (!document.hidden) return
    new Notification(`${roomName} — ${authorName}`, {
      body: message,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    })
  }

  return { notify }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return Notification.requestPermission()
}

export function useMessageNotifications(
  messages: { id: string; authorName: string; text: string; authorId: string }[],
  myUid: string | undefined,
  roomName: string,
  enabled: boolean,
) {
  const { notify } = useNotifications(roomName)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    if (!enabled) return
    if (messages.length > prevCountRef.current) {
      const latest = messages[messages.length - 1]
      if (latest && latest.authorId !== myUid && latest.text) {
        notify(latest.authorName, latest.text)
      }
    }
    prevCountRef.current = messages.length
  }, [messages, myUid, enabled, roomName])
}
