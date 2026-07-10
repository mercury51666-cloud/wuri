import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../contexts/ToastContext'
import {
  createTrackId,
  resolvePlaylist,
  type BgmPlaylistDoc,
  type LegacyRoomBgm,
  type PlaylistTrack,
} from '../utils/bgmPlaylist'
import { resolveMusicLink, platformEmoji, type MusicPlatform } from '../utils/musicLink'

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

function PlaylistRow({
  track,
  index,
  total,
  onOpen,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  track: PlaylistTrack
  index: number
  total: number
  onOpen: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  return (
    <div className="music-playlist-row">
      <span className="music-playlist-order">{index + 1}</span>
      <button type="button" onClick={onOpen} className="music-playlist-main">
        <div className="music-playlist-art">
          {track.thumbnail ? (
            <img src={track.thumbnail} alt="" />
          ) : (
            <span>{platformEmoji(track.platform)}</span>
          )}
        </div>
        <div className="music-playlist-info">
          <p className="music-playlist-title">{track.title}</p>
          {track.artist && <p className="music-playlist-artist">{track.artist}</p>}
          <p className="music-playlist-meta">
            {platformEmoji(track.platform)} {track.addedByUserName}
            {track.platform !== 'youtube' && ' · 앱 재생 불가'}
          </p>
        </div>
      </button>
      <div className="music-playlist-actions">
        <button type="button" onClick={onMoveUp} disabled={index === 0} className="music-playlist-sort" aria-label="위로">↑</button>
        <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="music-playlist-sort" aria-label="아래로">↓</button>
        <button type="button" onClick={onRemove} className="music-playlist-remove" aria-label="삭제">✕</button>
      </div>
    </div>
  )
}

export default function MusicBoard({ roomId }: Props) {
  const { user } = useAuthState()
  const { toast } = useToast()
  const [nowPlaying, setNowPlaying] = useState<NowPlayingEntry[]>([])
  const [legacyBgm, setLegacyBgm] = useState<LegacyRoomBgm | null>(null)
  const [playlistDoc, setPlaylistDoc] = useState<BgmPlaylistDoc | null>(null)
  const [myUrl, setMyUrl] = useState('')
  const [bgmUrl, setBgmUrl] = useState('')
  const [savingMine, setSavingMine] = useState(false)
  const [savingBgm, setSavingBgm] = useState(false)
  const [savingPlaylist, setSavingPlaylist] = useState(false)

  const { tracks, hasPlaylist } = useMemo(
    () => resolvePlaylist(legacyBgm, playlistDoc),
    [legacyBgm, playlistDoc],
  )

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
    const unsubLegacy = onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgm'), (snap) => {
      setLegacyBgm(snap.exists() ? (snap.data() as LegacyRoomBgm) : null)
    })
    const unsubPlaylist = onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgmPlaylist'), (snap) => {
      setPlaylistDoc(snap.exists() ? (snap.data() as BgmPlaylistDoc) : null)
    })
    return () => {
      unsubNow()
      unsubLegacy()
      unsubPlaylist()
    }
  }, [roomId, user?.uid])

  const myEntry = user ? nowPlaying.find((e) => e.userId === user.uid) : undefined
  const friendsPlaying = nowPlaying.filter((e) => e.userId !== user?.uid)

  const savePlaylist = async (nextTracks: PlaylistTrack[], currentIndex = playlistDoc?.currentIndex ?? 0) => {
    const clamped = nextTracks.length === 0 ? 0 : Math.min(currentIndex, nextTracks.length - 1)
    await setDoc(doc(db, 'rooms', roomId, 'meta', 'bgmPlaylist'), {
      tracks: nextTracks,
      currentIndex: clamped,
      updatedAt: Date.now(),
    })
  }

  const addToPlaylist = async () => {
    if (!user || !bgmUrl.trim() || savingBgm) return
    setSavingBgm(true)
    try {
      const meta = await resolveMusicLink(bgmUrl)
      const newTrack: PlaylistTrack = {
        ...meta,
        id: createTrackId(),
        addedByUserId: user.uid,
        addedByUserName: user.displayName || '친구',
        addedAt: Date.now(),
      }

      const baseTracks = hasPlaylist && playlistDoc?.tracks?.length ? playlistDoc.tracks : tracks
      await savePlaylist([...baseTracks, newTrack], playlistDoc?.currentIndex ?? 0)

      if (legacyBgm && !hasPlaylist) {
        await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'bgm'))
      }

      setBgmUrl('')
      toast('재생 목록에 추가! 🎶')
    } catch {
      toast('BGM 링크를 불러오지 못했어요')
    } finally {
      setSavingBgm(false)
    }
  }

  const removeTrack = async (trackId: string) => {
    if (!user || savingPlaylist) return
    setSavingPlaylist(true)
    try {
      const nextTracks = tracks.filter((t) => t.id !== trackId)
      await savePlaylist(nextTracks)
      if (nextTracks.length === 0) {
        await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'bgmPlaylist')).catch(() => {})
        await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'bgm')).catch(() => {})
      }
      toast('곡을 삭제했어요')
    } catch {
      toast('삭제에 실패했어요')
    } finally {
      setSavingPlaylist(false)
    }
  }

  const moveTrack = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= tracks.length || savingPlaylist) return
    setSavingPlaylist(true)
    try {
      const next = [...tracks]
      ;[next[index], next[target]] = [next[target], next[index]]
      let nextIndex = playlistDoc?.currentIndex ?? 0
      if (nextIndex === index) nextIndex = target
      else if (nextIndex === target) nextIndex = index
      await savePlaylist(next, nextIndex)
    } catch {
      toast('순서 변경에 실패했어요')
    } finally {
      setSavingPlaylist(false)
    }
  }

  const clearPlaylist = async () => {
    if (!user) return
    setSavingPlaylist(true)
    try {
      await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'bgmPlaylist')).catch(() => {})
      await deleteDoc(doc(db, 'rooms', roomId, 'meta', 'bgm')).catch(() => {})
      toast('방 BGM을 지웠어요')
    } catch {
      toast('삭제에 실패했어요')
    } finally {
      setSavingPlaylist(false)
    }
  }

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

  const openLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="music-board space-y-4">
      <div className="music-section music-section-bgm">
        <div className="music-section-head">
          <div>
            <p className="music-section-title">🎶 방 BGM</p>
            <p className="music-section-sub">재생 목록 · 순서대로 자동 재생</p>
          </div>
          {tracks.length > 0 && (
            <button type="button" onClick={clearPlaylist} disabled={savingPlaylist} className="music-clear-all">
              전체 삭제
            </button>
          )}
        </div>

        {tracks.length > 0 ? (
          <>
            <div className="music-playlist">
              {tracks.map((track, index) => (
                <PlaylistRow
                  key={track.id}
                  track={track}
                  index={index}
                  total={tracks.length}
                  onOpen={() => openLink(track.url)}
                  onMoveUp={() => moveTrack(index, -1)}
                  onMoveDown={() => moveTrack(index, 1)}
                  onRemove={() => removeTrack(track.id)}
                />
              ))}
            </div>
            <p className="music-bgm-hint">
              YouTube는 상단에서 노래만 재생돼요. 곡이 끝나면 다음 곡으로 넘어가요. 🔇 로 소리를 켜세요.
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
            onClick={addToPlaylist}
            disabled={savingBgm || !bgmUrl.trim()}
            className="btn btn-primary shrink-0 px-4"
          >
            {savingBgm ? '…' : '추가'}
          </button>
        </div>
      </div>

      <div className="music-section">
        <div className="music-section-head">
          <div>
            <p className="music-section-title">🎧 지금 듣는 중</p>
            <p className="music-section-sub">친구들에게 내 플레이리스트 자랑</p>
          </div>
        </div>

        {myEntry ? (
          <div className="music-card">
            <button type="button" onClick={() => openLink(myEntry.url)} className="music-card-main">
              <div className="music-card-art">
                {myEntry.thumbnail ? <img src={myEntry.thumbnail} alt="" /> : <span>{platformEmoji(myEntry.platform)}</span>}
              </div>
              <div className="music-card-info">
                <span className="music-card-badge">ME</span>
                <p className="music-card-title">{myEntry.title}</p>
                {myEntry.artist && <p className="music-card-artist">{myEntry.artist}</p>}
              </div>
            </button>
            <button type="button" onClick={clearNowPlaying} className="music-card-clear">지우기</button>
          </div>
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
                <button type="button" onClick={() => openLink(entry.url)} className="music-friend-main">
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
