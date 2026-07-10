import type { MusicMeta } from './musicLink'

export interface PlaylistTrack extends MusicMeta {
  id: string
  addedByUserId: string
  addedByUserName: string
  addedAt: number
}

export interface BgmPlaylistDoc {
  tracks: PlaylistTrack[]
  currentIndex: number
  updatedAt: number
}

export interface LegacyRoomBgm extends MusicMeta {
  setByUserId: string
  setByUserName: string
  updatedAt: number
}

export function createTrackId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function resolvePlaylist(
  legacy: LegacyRoomBgm | null,
  playlist: BgmPlaylistDoc | null,
): { tracks: PlaylistTrack[]; currentIndex: number; hasPlaylist: boolean } {
  if (playlist?.tracks?.length) {
    const index = Math.min(
      Math.max(playlist.currentIndex ?? 0, 0),
      playlist.tracks.length - 1,
    )
    return { tracks: playlist.tracks, currentIndex: index, hasPlaylist: true }
  }

  if (legacy) {
    return {
      tracks: [{
        id: 'legacy-bgm',
        url: legacy.url,
        title: legacy.title,
        artist: legacy.artist,
        thumbnail: legacy.thumbnail,
        platform: legacy.platform,
        addedByUserId: legacy.setByUserId,
        addedByUserName: legacy.setByUserName,
        addedAt: legacy.updatedAt,
      }],
      currentIndex: 0,
      hasPlaylist: false,
    }
  }

  return { tracks: [], currentIndex: 0, hasPlaylist: false }
}

export function clampIndex(index: number, length: number) {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}
