import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useToast } from '../contexts/ToastContext'
import {
  clampIndex,
  resolvePlaylist,
  type BgmPlaylistDoc,
  type LegacyRoomBgm,
} from '../utils/bgmPlaylist'
import { getYouTubeEmbedUrl, isYouTubePlayerMessage, parseYouTubeEnded } from '../utils/musicLink'

const BGM_HINT_KEY = 'wuri-bgm-unmute-hint'

interface Props {
  roomId: string
}

export default function RoomBgmPlayer({ roomId }: Props) {
  const { toast } = useToast()
  const [legacyBgm, setLegacyBgm] = useState<LegacyRoomBgm | null>(null)
  const [playlistDoc, setPlaylistDoc] = useState<BgmPlaylistDoc | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(true)
  const [playerEpoch, setPlayerEpoch] = useState(0)
  const hintShown = useRef(false)
  const indexWriteRef = useRef(0)

  const { tracks, currentIndex, hasPlaylist } = useMemo(
    () => resolvePlaylist(legacyBgm, playlistDoc),
    [legacyBgm, playlistDoc],
  )

  useEffect(() => {
    const unsubLegacy = onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgm'), (snap) => {
      setLegacyBgm(snap.exists() ? (snap.data() as LegacyRoomBgm) : null)
    })
    const unsubPlaylist = onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgmPlaylist'), (snap) => {
      setPlaylistDoc(snap.exists() ? (snap.data() as BgmPlaylistDoc) : null)
    })
    return () => {
      unsubLegacy()
      unsubPlaylist()
    }
  }, [roomId])

  useEffect(() => {
    if (Date.now() - indexWriteRef.current < 400) return
    setTrackIndex(currentIndex)
  }, [currentIndex])

  useEffect(() => {
    if (trackIndex >= tracks.length && tracks.length > 0) {
      setTrackIndex(0)
    }
  }, [tracks.length, trackIndex])

  const bumpPlayer = () => setPlayerEpoch((e) => e + 1)

  const persistIndex = useCallback(async (nextIndex: number) => {
    if (!hasPlaylist) {
      setTrackIndex(nextIndex)
      return
    }
    indexWriteRef.current = Date.now()
    setTrackIndex(nextIndex)
    try {
      await setDoc(
        doc(db, 'rooms', roomId, 'meta', 'bgmPlaylist'),
        { currentIndex: nextIndex, updatedAt: Date.now() },
        { merge: true },
      )
    } catch {
      /* local playback continues */
    }
  }, [hasPlaylist, roomId])

  const goNext = useCallback(async (auto = false) => {
    if (tracks.length === 0) return
    if (tracks.length === 1) {
      if (auto) bumpPlayer()
      return
    }
    const next = clampIndex(trackIndex + 1, tracks.length)
    setPlaying(true)
    bumpPlayer()
    await persistIndex(next)
  }, [tracks.length, trackIndex, persistIndex])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isYouTubePlayerMessage(event.origin)) return
      if (typeof event.data !== 'string') return
      if (parseYouTubeEnded(event.data)) {
        goNext(true)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [goNext])

  useEffect(() => {
    if (tracks.length === 0 || hintShown.current) return
    if (!muted) return
    try {
      if (localStorage.getItem(BGM_HINT_KEY)) return
      localStorage.setItem(BGM_HINT_KEY, '1')
      hintShown.current = true
      toast('🔇 눌러 소리를 켜주세요!')
    } catch {
      toast('🔇 눌러 소리를 켜주세요!')
    }
  }, [tracks.length, muted, toast])

  if (tracks.length === 0) return null

  const current = tracks[trackIndex] ?? tracks[0]
  const isYoutube = current.platform === 'youtube'
  const canNext = tracks.length > 1
  const queueLabel = tracks.length > 1 ? `${trackIndex + 1}/${tracks.length}` : null

  const youtubeEmbed =
    isYoutube && playing
      ? getYouTubeEmbedUrl(current.url, {
          autoplay: true,
          mute: muted,
          loop: tracks.length === 1,
          controls: false,
          enableJsApi: true,
        })
      : null

  const restart = () => {
    setPlaying(true)
    bumpPlayer()
  }

  const togglePlay = () => {
    if (playing) {
      setPlaying(false)
      return
    }
    setPlaying(true)
    bumpPlayer()
  }

  const stop = () => setPlaying(false)

  const nextTrack = () => {
    if (!canNext) return
    goNext(false)
  }

  return (
    <div className="room-bgm-player">
      <div className="room-bgm-player-bar">
        <div className="room-bgm-player-art">
          {current.thumbnail ? (
            <img src={current.thumbnail} alt="" />
          ) : (
            <span>🎵</span>
          )}
          {playing && isYoutube && (
            <span className="room-bgm-player-eq" aria-hidden>
              <span /><span /><span />
            </span>
          )}
        </div>

        <div className="room-bgm-player-meta">
          <div className="room-bgm-player-headline">
            <span className="room-bgm-player-badge">
              ON AIR{queueLabel ? ` · ${queueLabel}` : ''}
            </span>
            <p className="room-bgm-player-title">{current.title}</p>
          </div>
        </div>

        {isYoutube ? (
          <div className="room-bgm-player-controls">
            <button type="button" className="room-bgm-player-ctrl" onClick={restart} aria-label="처음부터" title="처음부터">⏮</button>
            <button
              type="button"
              className="room-bgm-player-ctrl room-bgm-player-ctrl-play"
              onClick={togglePlay}
              aria-label={playing ? '일시정지' : '재생'}
              title={playing ? '일시정지' : '재생'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button type="button" className="room-bgm-player-ctrl" onClick={stop} aria-label="정지" title="정지">⏹</button>
            <button
              type="button"
              className="room-bgm-player-ctrl"
              onClick={nextTrack}
              disabled={!canNext}
              aria-label="다음 곡"
              title={canNext ? '다음 곡' : '다음 곡 없음'}
            >
              ⏭
            </button>
            <button
              type="button"
              className="room-bgm-player-ctrl room-bgm-player-ctrl-mute"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? '소리 켜기' : '음소거'}
              title={muted ? '소리 켜기' : '음소거'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        ) : (
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="room-bgm-player-unmute"
          >
            ▶
          </a>
        )}
      </div>

      {youtubeEmbed && (
        <div className="room-bgm-player-audio-engine" aria-hidden>
          <iframe
            key={`${playerEpoch}-${trackIndex}-${muted ? 'm' : 'u'}`}
            src={youtubeEmbed}
            title={`방 BGM: ${current.title}`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            onLoad={(e) => {
              const win = (e.target as HTMLIFrameElement).contentWindow
              win?.postMessage(JSON.stringify({ event: 'listening' }), '*')
            }}
          />
        </div>
      )}
    </div>
  )
}
