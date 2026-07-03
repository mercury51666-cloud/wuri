import { useEffect, useMemo, useState } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { getYouTubeEmbedUrl, type MusicPlatform } from '../utils/musicLink'

interface Track {
  url: string
  title: string
  artist?: string
  thumbnail?: string
  platform: MusicPlatform
}

interface RoomBgm extends Track {
  setByUserName: string
}

interface NowPlayingEntry extends Track {
  userId: string
  userName: string
}

interface Props {
  roomId: string
}

function buildQueue(bgm: RoomBgm | null, nowPlaying: NowPlayingEntry[]): Track[] {
  const items: Track[] = []
  const seen = new Set<string>()

  const add = (track: Track) => {
    if (track.platform !== 'youtube' || seen.has(track.url)) return
    seen.add(track.url)
    items.push(track)
  }

  if (bgm) add(bgm)
  nowPlaying.forEach(add)
  return items
}

export default function RoomBgmPlayer({ roomId }: Props) {
  const [bgm, setBgm] = useState<RoomBgm | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlayingEntry[]>([])
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [muted, setMuted] = useState(true)
  const [playerEpoch, setPlayerEpoch] = useState(0)

  useEffect(() => {
    const unsubBgm = onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgm'), (snap) => {
      setBgm(snap.exists() ? (snap.data() as RoomBgm) : null)
    })
    const unsubNow = onSnapshot(collection(db, 'rooms', roomId, 'nowPlaying'), (snap) => {
      setNowPlaying(snap.docs.map((d) => d.data() as NowPlayingEntry))
    })
    return () => {
      unsubBgm()
      unsubNow()
    }
  }, [roomId])

  const queue = useMemo(() => buildQueue(bgm, nowPlaying), [bgm, nowPlaying])

  useEffect(() => {
    setTrackIndex(0)
    setPlaying(true)
    setPlayerEpoch((e) => e + 1)
  }, [bgm?.url])

  useEffect(() => {
    if (trackIndex >= queue.length) setTrackIndex(0)
  }, [queue.length, trackIndex])

  if (!bgm) return null

  const current = queue[trackIndex] ?? queue[0]
  const isYoutube = current?.platform === 'youtube'
  const canNext = queue.length > 1
  const queueLabel = queue.length > 1 ? `${trackIndex + 1}/${queue.length}` : null

  const youtubeEmbed =
    isYoutube && playing && current
      ? getYouTubeEmbedUrl(current.url, {
          autoplay: true,
          mute: muted,
          loop: queue.length === 1,
          controls: false,
        })
      : null

  const bumpPlayer = () => setPlayerEpoch((e) => e + 1)

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
    setTrackIndex((i) => (i + 1) % queue.length)
    setPlaying(true)
    bumpPlayer()
  }

  const display = current ?? bgm

  return (
    <div className="room-bgm-player">
      <div className="room-bgm-player-bar">
        <div className="room-bgm-player-art">
          {display.thumbnail ? (
            <img src={display.thumbnail} alt="" />
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
            <p className="room-bgm-player-title">{display.title}</p>
          </div>
        </div>

        {isYoutube ? (
          <div className="room-bgm-player-controls">
            <button
              type="button"
              className="room-bgm-player-ctrl"
              onClick={restart}
              aria-label="처음부터"
              title="처음부터"
            >
              ⏮
            </button>
            <button
              type="button"
              className="room-bgm-player-ctrl room-bgm-player-ctrl-play"
              onClick={togglePlay}
              aria-label={playing ? '일시정지' : '재생'}
              title={playing ? '일시정지' : '재생'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              className="room-bgm-player-ctrl"
              onClick={stop}
              aria-label="정지"
              title="정지"
            >
              ⏹
            </button>
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
            href={bgm.url}
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
            title={`방 BGM: ${display.title}`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  )
}
