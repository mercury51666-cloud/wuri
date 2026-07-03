import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import {
  getSpotifyEmbedUrl,
  getYouTubeEmbedUrl,
  type MusicPlatform,
} from '../utils/musicLink'

interface RoomBgm {
  url: string
  title: string
  artist?: string
  platform: MusicPlatform
  setByUserName: string
}

interface Props {
  roomId: string
}

export default function RoomBgmPlayer({ roomId }: Props) {
  const [bgm, setBgm] = useState<RoomBgm | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    return onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgm'), (snap) => {
      setBgm(snap.exists() ? (snap.data() as RoomBgm) : null)
    })
  }, [roomId])

  if (!bgm) return null

  const youtubeEmbed =
    bgm.platform === 'youtube'
      ? getYouTubeEmbedUrl(bgm.url, { autoplay: true, mute: muted, loop: true })
      : null
  const spotifyEmbed =
    bgm.platform === 'spotify' ? getSpotifyEmbedUrl(bgm.url) : null
  const canEmbed = Boolean(youtubeEmbed || spotifyEmbed)

  return (
    <div className={`room-bgm-player ${expanded ? 'room-bgm-player-open' : 'room-bgm-player-mini'}`}>
      <div className="room-bgm-player-head">
        <button
          type="button"
          className="room-bgm-player-info"
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="room-bgm-player-badge">ON AIR</span>
          <span className="room-bgm-player-title">{bgm.title}</span>
          {bgm.artist && <span className="room-bgm-player-artist">{bgm.artist}</span>}
        </button>
        <div className="room-bgm-player-actions">
          {youtubeEmbed && muted && (
            <button
              type="button"
              className="room-bgm-player-unmute"
              onClick={() => setMuted(false)}
            >
              🔊 소리 켜기
            </button>
          )}
          <button
            type="button"
            className="room-bgm-player-toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? '플레이어 접기' : '플레이어 펼치기'}
          >
            {expanded ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {canEmbed && (
        <div className={`room-bgm-player-frame ${expanded ? '' : 'room-bgm-player-frame-hidden'}`}>
          {youtubeEmbed && (
            <iframe
              key={`${youtubeEmbed}-${muted ? 'm' : 'u'}`}
              src={youtubeEmbed}
              title={`방 BGM: ${bgm.title}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          )}
          {spotifyEmbed && (
            <>
              <iframe
                src={spotifyEmbed}
                title={`방 BGM: ${bgm.title}`}
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
              <p className="room-bgm-player-hint">Spotify는 ▶ 버튼을 눌러 재생해요</p>
            </>
          )}
        </div>
      )}

      {expanded && !canEmbed && (
        <div className="room-bgm-player-fallback">
          <p>이 링크는 앱 안 재생을 지원하지 않아요</p>
          <a href={bgm.url} target="_blank" rel="noopener noreferrer" className="room-bgm-player-link">
            앱에서 열기
          </a>
        </div>
      )}
    </div>
  )
}
