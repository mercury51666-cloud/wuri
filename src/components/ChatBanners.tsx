import type { RoomMetaState } from '../hooks/useRoomExtras'

interface Props {
  meta: RoomMetaState
}

export default function ChatBanners({ meta }: Props) {
  if (!meta.birthdays?.length) return null

  return (
    <div className="mx-4 mt-2 space-y-1 shrink-0">
      <div className="chat-banner banner-birthday text-[11px] px-3 py-1.5 rounded-xl font-semibold">
        🎂 생일 축하 {meta.birthdays.map((b) => b.name).join(', ')}님!
      </div>
    </div>
  )
}
