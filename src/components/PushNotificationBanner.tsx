import { useState } from 'react'
import { Bell } from 'lucide-react'
import { isPushSupported, requestPushNotifications } from '../utils/pushNotifications'

interface Props {
  userId: string
}

export default function PushNotificationBanner({ userId }: Props) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('wuri_push_dismissed') === '1')
  const [enabled, setEnabled] = useState(() => Notification.permission === 'granted')

  if (!isPushSupported() || enabled || dismissed || Notification.permission === 'denied') {
    return null
  }

  return (
    <div className="mx-4 mb-3 card-flat p-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center shrink-0">
        <Bell className="w-5 h-5 text-[var(--brand)]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--text)]">새 메시지 알림</p>
        <p className="text-xs text-[var(--text-muted)]">앱을 꺼도 메시지가 오면 알려드려요</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          const ok = await requestPushNotifications(userId)
          if (ok) {
            setEnabled(true)
            localStorage.setItem('wuri_push_dismissed', '1')
          }
        }}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-[var(--brand)] text-white text-xs font-bold"
      >
        켜기
      </button>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem('wuri_push_dismissed', '1')
          setDismissed(true)
        }}
        className="shrink-0 text-xs text-[var(--text-muted)] px-1"
      >
        ✕
      </button>
    </div>
  )
}
