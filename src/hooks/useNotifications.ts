import { useEffect, useRef } from 'react'

const isNotificationSupported = typeof window !== 'undefined' && 'Notification' in window

export function useNotifications(roomName: string) {
  const permissionRef = useRef(isNotificationSupported ? Notification.permission : 'denied')

  const requestPermission = async () => {
    if (!isNotificationSupported) return
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      permissionRef.current = result
    }
  }

  const notify = (authorName: string, message: string) => {
    if (!isNotificationSupported) return
    if (permissionRef.current === 'granted' && document.hidden) {
      new Notification(`${roomName} — ${authorName}`, {
        body: message,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
      })
    }
  }

  return { requestPermission, notify }
}

export function useMessageNotifications(
  messages: { id: string; authorName: string; text: string; authorId: string }[],
  myUid: string | undefined,
  roomName: string
) {
  const { requestPermission, notify } = useNotifications(roomName)
  const prevCountRef = useRef(messages.length)

  useEffect(() => {
    requestPermission()
  }, [])

  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const latest = messages[messages.length - 1]
      if (latest && latest.authorId !== myUid && latest.text) {
        notify(latest.authorName, latest.text)
      }
    }
    prevCountRef.current = messages.length
  }, [messages.length])
}
