import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { getYouTubeEmbedUrl, type MusicPlatform } from '../utils/musicLink'

interface RoomBgm {
  url: string
  title: string
  artist?: string
  thumbnail?: string
  platform: MusicPlatform
  setByUserName: string
}

interface Props {
  roomId: string
}

export default function RoomBgmPlayer({ roomId }: Props) {
  const [bgm, setBgm] = useState<RoomBgm | null>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    return onSnapshot(doc(db, 'rooms', roomId, 'meta', 'bgm'), (snap) => {
      setBgm(snap.exists() ? (snap.data() as RoomBgm) : null)
    })
  }, [roomId])

  if (!bgm) return null

  const youtubeEmbed =
    bgm.platform === 'youtube'
      ? getYouTubeEmbedUrl(bgm.url, { autoplay: true, mute: muted, loop: true, controls: false })
      : null

  return (
    <div className="room-bgm-player">
      <div className="room-bgm-player-bar">
        <div className="room-bgm-player-art">
          {bgm.thumbnail ? (
            <img src={bgm.thumbnail} alt="" />
          ) : (
            <span>🎵</span>
          )}
          {youtubeEmbed && (
            <span className="room-bgm-player-eq" aria-hidden>
              <span /><span /><span />
            </span>
          )}
        </div>

        <div className="room-bgm-player-meta">
          <span className="room-bgm-player-badge">ON AIR</span>
          <p className="room-bgm-player-title">{bgm.title}</p>
          {bgm.artist && <p className="room-bgm-player-artist">{bgm.artist}</p>}
        </div>

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
          {bgm.platform !== 'youtube' && (
            <a
              href={bgm.url}
              target="_blank"
              rel="noopener noreferrer"
              className="room-bgm-player-unmute"
            >
              ▶ 듣기
            </a>
          )}
        </div>
      </div>

      {youtubeEmbed && (
        <div className="room-bgm-player-audio-engine" aria-hidden>
          <iframe
            key={`${youtubeEmbed}-${muted ? 'm' : 'u'}`}
            src={youtubeEmbed}
            title={`방 BGM: ${bgm.title}`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
          />
        </div>
      )}
    </div>
  )
}
