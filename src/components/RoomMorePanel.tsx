import {
  Smile, Target, MapPin, Medal, Users, Pencil, ImageIcon, Link2, Moon, Sun, LogOut, ChevronRight,
} from 'lucide-react'
import RoomAvatar from './RoomAvatar'
import RankBadge from './RankBadge'
import type { RoomRankData } from '../utils/roomPoints'
import type { MoreSubTab } from './RoomBottomNav'

interface RoomInfo {
  name: string
  emoji?: string
  photoURL?: string
  joinCode?: string
  memberIds: string[]
}

interface Props {
  room: RoomInfo
  dark: boolean
  isJoined: boolean
  changingPhoto: boolean
  memberRanks: Record<string, RoomRankData>
  memberProfiles: Record<string, { displayName: string; photoURL?: string | null }>
  onSelectTab: (tab: MoreSubTab) => void
  onInvite: () => void
  onRename: () => void
  onChangePhoto: () => void
  onToggleDark: () => void
  onLeave: () => void
  onViewProfile: (name: string, photoURL?: string, userId?: string) => void
}

const FEATURES: { id: MoreSubTab; label: string; desc: string; Icon: typeof Smile; color: string }[] = [
  { id: 'mood', label: '기분', desc: '오늘 기분 공유', Icon: Smile, color: 'bg-pink-500/10 text-pink-500' },
  { id: 'mission', label: '미션', desc: '사진 미션', Icon: Target, color: 'bg-amber-500/10 text-amber-500' },
  { id: 'location', label: '위치', desc: '위치 공유', Icon: MapPin, color: 'bg-blue-500/10 text-blue-500' },
  { id: 'stats', label: '계급', desc: '활동 & 순위', Icon: Medal, color: 'bg-emerald-500/10 text-emerald-500' },
]

export default function RoomMorePanel({
  room, dark, isJoined, changingPhoto, memberRanks, memberProfiles,
  onSelectTab, onInvite, onRename, onChangePhoto, onToggleDark, onLeave, onViewProfile,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-6">
      <div className="card p-4 flex items-center gap-3">
        <RoomAvatar photoURL={room.photoURL} emoji={room.emoji} name={room.name} className="w-14 h-14" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[var(--text)] truncate">{room.name}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">멤버 {room.memberIds.length}명</p>
          {room.joinCode && (
            <p className="text-xs text-[var(--brand)] font-mono tracking-wider mt-1">🔑 {room.joinCode}</p>
          )}
        </div>
      </div>

      <div>
        <p className="label-caps px-1 mb-2">기능</p>
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map(({ id, label, desc, Icon, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              className="card-flat p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon size={20} />
              </div>
              <p className="font-bold text-sm text-[var(--text)]">{label}</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="label-caps px-1 mb-2 flex items-center gap-1"><Users size={12} /> 멤버</p>
        <div className="card-flat overflow-hidden divide-y divide-[var(--border)]">
          {room.memberIds.map((uid) => {
            const profile = memberProfiles[uid]
            const rank = memberRanks[uid]
            return (
              <button
                key={uid}
                type="button"
                onClick={() => profile && onViewProfile(profile.displayName, profile.photoURL ?? undefined, uid)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-2)] transition-colors"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--brand-soft)] shrink-0">
                  {profile?.photoURL
                    ? <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                    : <span className="w-full h-full flex items-center justify-center text-sm font-bold text-[var(--brand)]">{(profile?.displayName ?? '?')[0]}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">{profile?.displayName ?? '...'}</p>
                  {rank
                    ? <RankBadge rank={rank} />
                    : <RankBadge rank={{ rankName: '이병', points: 0 }} />}
                </div>
                <ChevronRight size={16} className="text-[var(--text-muted)]" />
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="label-caps px-1 mb-2">설정</p>
        <div className="card-flat overflow-hidden divide-y divide-[var(--border)]">
          {isJoined && (
            <>
              <MenuRow icon={Pencil} label="방 이름 변경" onClick={onRename} />
              <MenuRow icon={ImageIcon} label={changingPhoto ? '사진 변경 중...' : '방 사진 변경'} onClick={onChangePhoto} disabled={changingPhoto} />
            </>
          )}
          <MenuRow icon={Link2} label="친구 초대" onClick={onInvite} />
          <MenuRow icon={dark ? Sun : Moon} label={dark ? '라이트 모드' : '다크 모드'} onClick={onToggleDark} />
          {isJoined && (
            <MenuRow icon={LogOut} label="방 나가기" onClick={onLeave} danger />
          )}
        </div>
      </div>
    </div>
  )
}

function MenuRow({ icon: Icon, label, onClick, danger, disabled }: {
  icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50 ${danger ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}
    >
      <Icon size={18} className={danger ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]'} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
