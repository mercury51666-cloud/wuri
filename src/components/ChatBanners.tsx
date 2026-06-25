import type { RoomMetaState } from '../hooks/useRoomExtras'

interface Props {
  meta: RoomMetaState
  loginStreak: number
}

export default function ChatBanners({ meta, loginStreak }: Props) {
  const items: { icon: string; text: string; cls: string }[] = []

  if (meta.mvp) {
    items.push({
      icon: '👑',
      text: `오늘의 MVP ${meta.mvp.userName} (${meta.mvp.score}점)`,
      cls: 'banner-mvp',
    })
  }
  if (meta.weeklyChampion) {
    items.push({
      icon: '🏆',
      text: `${meta.weeklyChampion.title} ${meta.weeklyChampion.userName}`,
      cls: 'banner-champion',
    })
  }
  if (meta.birthdays?.length) {
    items.push({
      icon: '🎂',
      text: `생일 축하 ${meta.birthdays.map((b) => b.name).join(', ')}님!`,
      cls: 'banner-birthday',
    })
  }
  if (meta.groupMission) {
    const { total, goal } = meta.groupMission
    items.push({
      icon: '🎯',
      text: `단체 미션 ${total}/${goal}${total >= goal ? ' 달성!' : ''}`,
      cls: 'banner-group',
    })
  }
  if (meta.roomTheme && meta.roomTheme.until > Date.now()) {
    items.push({
      icon: '🎨',
      text: `${meta.roomTheme.byUserName}님이 방 테마 변경 중`,
      cls: 'banner-theme',
    })
  }
  if (loginStreak >= 2) {
    items.push({
      icon: '🔥',
      text: `연속 출석 ${loginStreak}일`,
      cls: 'banner-streak',
    })
  }

  if (items.length === 0) return null

  return (
    <div className="mx-4 mt-2 space-y-1 shrink-0">
      {items.map((item) => (
        <div key={item.text} className={`chat-banner ${item.cls} text-[11px] px-3 py-1.5 rounded-xl font-semibold`}>
          {item.icon} {item.text}
        </div>
      ))}
    </div>
  )
}
