import { useEffect, useState } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../contexts/ToastContext'
import { resolveMusicLink, platformEmoji, platformLabel, type MusicPlatform } from '../utils/musicLink'

interface Props {
  roomId: string
}

interface MusicEntry {
  url: string
  title: string
  artist?: string
  thumbnail?: string
  platform: MusicPlatform
  updatedAt: number
}

interface NowPlayingEntry extends MusicEntry {
  userId: string
  userName: string
  photoURL?: string
}

interface RoomBgm extends MusicEntry {
  setByUserId: string
  setByUserName: string
}

function MusicCard({
  entry,
  subtitle,
  badge,
  onOpen,
  onClear,
  canClear,
}: {
  entry: MusicEntry
  subtitle?: string
  badge?: string
  onOpen: () => void
  onClear?: () => void
  canClear?: boolean
}) {
  return (
    <div className="music-card">
      <button type="button" onClick={onOpen} className="music-card-main">
        <div className="music-card-art">
          {entry.thumbnail ? (
            <img src={entry.thumbnail} alt="" />
          ) : (
            <span>{platformEmoji(entry.platform)}</span>
          )}
        </div>
        <div className="music-card-info">
          {badge && <span className="music-card-badge">{badge}</span>}
          <p className="music-card-title">{entry.title}</p>
          {entry.artist && <p className="music-card-artist">{entry.artist}</p>}
          <p className="music-card-platform">
            {platformEmoji(entry.platform)} {platformLabel(entry.platform)}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
      </button>
      {canClear && onClear && (
        <button type="button" onClick={onClear} className="music-card-clear">
          지우기
        </button>
      )}
    </div>
  )
}

export default function MusicBoard({ roomId }: Props) {
  const { user } = useAuthState()
  const { toast } = useToast()
  const [nowPlaying, setNowPlaying] = useState<NowPlayingEntry[]>([])
  const [roomBgm, setRoomBgm] = useState<RoomBgm | null>(null)
  const [myUrl, setMyUrl] = useState('')
  const [bgmUrl, setBgmUrl] = useState('')
  const [savingMine, setSavingMine] = useState(false)
  const [savingBgm, setSavingBgm] = useState(false)

  useEffect(() => {
    const unsubNow = onSnapshot(collection(db, 'rooms', roomId, 'nowPlaying'), (snap) => {
      const entries = snap.docs.map((d) => d.data() as NowPlayingEntry)
      setNowPlaying(
        entries.sort((a, b) => {
          if (a.userId === user?.uid) return -1
          if (b.userId === user?.uid) return 1
          return b.updatedAt - a.updatedAt
        }),
      )
    })
    const unsubBgm = onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgm'), (snap) => {
      setRoomBgm(snap.exists() ? (snap.data() as RoomBgm) : null)
    })
    return () => {
      unsubNow()
      unsubBgm()
    }
  }, [roomId, user?.uid])

  const myEntry = user ? nowPlaying.find((e) => e.userId === user.uid) : undefined
  const friendsPlaying = nowPlaying.filter((e) => e.userId !== user?.uid)

  const saveNowPlaying = async () => {
    if (!user || !myUrl.trim() || savingMine) return
    setSavingMine(true)
    try {
      const meta = await resolveMusicLink(myUrl)
      await setDoc(doc(db, 'rooms', roomId, 'nowPlaying', user.uid), {
        userId: user.uid,
        userName: user.displayName || '친구',
        photoURL: user.photoURL || '',
        ...meta,
        updatedAt: Date.now(),
      })
      setMyUrl('')
      toast('지금 듣는 중 등록! 🎧')
    } catch {
      toast('링크를 불러오지 못했어요. URL을 확인해주세요')
    } finally {
      setSavingMine(false)
    }
  }

  const clearNowPlaying = async () => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'nowPlaying', user.uid))
      toast('듣는 중 표시를 지웠어요')
    } catch {
      toast('삭제에 실패했어요')
    }
  }

  const saveRoomBgm = async () => {
    if (!user || !bgmUrl.trim() || savingBgm) return
    setSavingBgm(true)
    try {
      const meta = await resolveMusicLink(bgmUrl)
      await setDoc(doc(db, 'rooms', roomId, 'meta', 'bgm'), {
        ...meta,
        setByUserId: user.uid,
        setByUserName: user.displayName || '친구',
        updatedAt: Date.now(),
      })
      setBgmUrl('')
      toast('방 BGM 설정 완료! 🎶')
    } catch {
      toast('BGM 링크를 불러오지 못했어요')
    } finally {
      setSavingBgm(false)
    }
  }

  const clearRoomBgm = async () => {
    if (!user) return
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'bgm'))
      toast('방 BGM을 지웠어요')
    } catch {
      toast('삭제에 실패했어요')
    }
  }

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="music-board space-y-4">
      {/* 방 BGM */}
      <div className="music-section music-section-bgm">
        <div className="music-section-head">
          <div>
            <p className="music-section-title">🎶 방 BGM</p>
            <p className="music-section-sub">우리 방 분위기 대표곡</p>
          </div>
        </div>

        {roomBgm ? (
          <>
            <MusicCard
              entry={roomBgm}
              subtitle={`${roomBgm.setByUserName}이(가) 설정 · 방 안 자동 재생`}
              badge="ON AIR"
              onOpen={() => openLink(roomBgm.url)}
              onClear={clearRoomBgm}
              canClear
            />
            <p className="music-bgm-hint">
              YouTube는 영상 없이 노래만 재생돼요. 하단 바에서 🔊 소리 켜기를 눌러주세요.
            </p>
          </>
        ) : (
          <div className="music-empty">
            <p>아직 방 BGM이 없어요</p>
          </div>
        )}

        <div className="music-input-row">
          <input
            type="url"
            value={bgmUrl}
            onChange={(e) => setBgmUrl(e.target.value)}
            placeholder="YouTube · Spotify 링크"
            className="input-field flex-1"
            style={{ fontSize: '16px' }}
          />
          <button
            type="button"
            onClick={saveRoomBgm}
            disabled={savingBgm || !bgmUrl.trim()}
            className="btn btn-primary shrink-0 px-4"
          >
            {savingBgm ? '…' : '설정'}
          </button>
        </div>
      </div>

      {/* 내 지금 듣는 중 */}
      <div className="music-section">
        <div className="music-section-head">
          <div>
            <p className="music-section-title">🎧 지금 듣는 중</p>
            <p className="music-section-sub">친구들에게 내 플레이리스트 자랑</p>
          </div>
        </div>

        {myEntry ? (
          <MusicCard
            entry={myEntry}
            badge="ME"
            onOpen={() => openLink(myEntry.url)}
            onClear={clearNowPlaying}
            canClear
          />
        ) : (
          <div className="music-empty">
            <p>지금 듣는 곡을 알려줘!</p>
          </div>
        )}

        <div className="music-input-row">
          <input
            type="url"
            value={myUrl}
            onChange={(e) => setMyUrl(e.target.value)}
            placeholder="지금 듣는 곡 링크"
            className="input-field flex-1"
            style={{ fontSize: '16px' }}
          />
          <button
            type="button"
            onClick={saveNowPlaying}
            disabled={savingMine || !myUrl.trim()}
            className="btn btn-primary shrink-0 px-4"
          >
            {savingMine ? '…' : '등록'}
          </button>
        </div>
      </div>

      {/* 친구들 */}
      <div className="music-section">
        <div className="music-section-head">
          <p className="music-section-title">👯 친구들은 지금</p>
          <span className="music-count">{friendsPlaying.length}명</span>
        </div>

        {friendsPlaying.length === 0 ? (
          <div className="music-empty">
            <p>아직 아무도 곡을 등록하지 않았어요</p>
          </div>
        ) : (
          <div className="music-friends-list">
            {friendsPlaying.map((entry) => (
              <div key={entry.userId} className="music-friend-row">
                <div className="music-friend-avatar">
                  {entry.photoURL ? (
                    <img src={entry.photoURL} alt="" />
                  ) : (
                    <span>{entry.userName.slice(0, 1)}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openLink(entry.url)}
                  className="music-friend-main"
                >
                  <p className="music-friend-name">{entry.userName}</p>
                  <p className="music-friend-track">{entry.title}</p>
                  {entry.artist && <p className="music-friend-artist">{entry.artist}</p>}
                </button>
                <span className="music-friend-platform">{platformEmoji(entry.platform)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
