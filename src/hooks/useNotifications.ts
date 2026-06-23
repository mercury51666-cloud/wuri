import { useEffect, useRef } from 'react'

export function useNotifications(roomName: string) {
  const permissionRef = useRef(Notification.permission)

  const requestPermission = async () => {
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission()
      permissionRef.current = result
    }
  }

  const notify = (authorName: string, message: string) => {
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
