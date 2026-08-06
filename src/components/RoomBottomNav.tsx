import { MessageCircle, Image, Calendar, LayoutGrid } from 'lucide-react'

export type PrimaryTab = 'chat' | 'gallery' | 'schedule' | 'more'
export type MoreSubTab = 'mood' | 'mission' | 'location' | 'stats' | 'music' | 'ai'
export type RoomTab = PrimaryTab | MoreSubTab

export const MORE_SUB_TABS: MoreSubTab[] = ['mood', 'mission', 'location', 'stats', 'music', 'ai']

const NAV: { id: PrimaryTab; label: string; Icon: typeof MessageCircle }[] = [
  { id: 'chat', label: '채팅', Icon: MessageCircle },
  { id: 'gallery', label: '사진', Icon: Image },
  { id: 'schedule', label: '일정', Icon: Calendar },
  { id: 'more', label: '더보기', Icon: LayoutGrid },
]

interface Props {
  activeTab: RoomTab
  onChange: (tab: PrimaryTab) => void
}

export function isMoreSection(tab: RoomTab) {
  return tab === 'more' || MORE_SUB_TABS.includes(tab as MoreSubTab)
}

export default function RoomBottomNav({ activeTab, onChange }: Props) {
  return (
    <nav className="tab-bar shrink-0 grid grid-cols-4">
      {NAV.map(({ id, label, Icon }) => {
        const active = id === 'more' ? isMoreSection(activeTab) : activeTab === id
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`tab-item ${active ? 'active' : ''}`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 2} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export const TAB_TITLES: Record<RoomTab, string> = {
  chat: '채팅',
  gallery: '사진',
  schedule: '일정·D-day',
  more: '더보기',
  mood: '기분',
  mission: '미션',
  location: '친구 지도',
  stats: '계급',
  music: '음악',
  ai: 'AI에게 물어보기',
}
