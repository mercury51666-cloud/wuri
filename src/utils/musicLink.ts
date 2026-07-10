export type MusicPlatform = 'youtube' | 'spotify' | 'apple' | 'other'

export interface MusicMeta {
  url: string
  title: string
  artist?: string
  thumbnail?: string
  platform: MusicPlatform
}

function detectPlatform(url: string): MusicPlatform {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/spotify\.com/i.test(url)) return 'spotify'
  if (/music\.apple\.com/i.test(url)) return 'apple'
  return 'other'
}

function normalizeUrl(input: string) {
  const trimmed = input.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function extractYouTubeId(url: string) {
  const patterns = [
    /youtu\.be\/([^?&/]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&/]+)/,
    /youtube\.com\/shorts\/([^?&/]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function fetchOEmbed(endpoint: string) {
  try {
    const res = await fetch(endpoint)
    if (!res.ok) return null
    return await res.json() as { title?: string; author_name?: string; thumbnail_url?: string }
  } catch {
    return null
  }
}

function splitSpotifyTitle(title: string) {
  const parts = title.split(' · ')
  if (parts.length >= 2) {
    return { title: parts[0], artist: parts.slice(1).join(' · ') }
  }
  return { title, artist: undefined }
}

export async function resolveMusicLink(input: string): Promise<MusicMeta> {
  const url = normalizeUrl(input)
  const platform = detectPlatform(url)

  if (platform === 'youtube') {
    const id = extractYouTubeId(url)
    const oembed = await fetchOEmbed(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    )
    return {
      url,
      platform,
      title: oembed?.title ?? 'YouTube',
      artist: oembed?.author_name,
      thumbnail: id
        ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
        : oembed?.thumbnail_url,
    }
  }

  if (platform === 'spotify') {
    const oembed = await fetchOEmbed(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
    )
    const parsed = splitSpotifyTitle(oembed?.title ?? 'Spotify')
    return {
      url,
      platform,
      title: parsed.title,
      artist: parsed.artist,
      thumbnail: oembed?.thumbnail_url,
    }
  }

  if (platform === 'apple') {
    return {
      url,
      platform,
      title: 'Apple Music',
      artist: undefined,
      thumbnail: undefined,
    }
  }

  let host = '음악 링크'
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    /* ignore */
  }

  return { url, platform, title: host }
}

export function extractYouTubeVideoId(url: string) {
  return extractYouTubeId(url)
}

export function getYouTubeEmbedUrl(
  url: string,
  opts?: { autoplay?: boolean; mute?: boolean; loop?: boolean; controls?: boolean; enableJsApi?: boolean },
) {
  const id = extractYouTubeId(url)
  if (!id) return null
  const params = new URLSearchParams({
    autoplay: opts?.autoplay !== false ? '1' : '0',
    mute: opts?.mute ? '1' : '0',
    loop: opts?.loop !== false ? '1' : '0',
    playlist: id,
    controls: opts?.controls === false ? '0' : '1',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    iv_load_policy: '3',
  })
  if (opts?.enableJsApi !== false) {
    params.set('enablejsapi', '1')
    if (typeof window !== 'undefined') {
      params.set('origin', window.location.origin)
    }
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

const YT_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com']

export function isYouTubePlayerMessage(origin: string) {
  return YT_ORIGINS.includes(origin)
}

/** YouTube iframe postMessage: playerState 0 = ended */
export function parseYouTubeEnded(data: string): boolean {
  try {
    const parsed = JSON.parse(data) as {
      event?: string
      info?: number | { playerState?: number }
    }
    if (parsed.event === 'onStateChange' && parsed.info === 0) return true
    if (parsed.event === 'infoDelivery') {
      if (typeof parsed.info === 'number' && parsed.info === 0) return true
      if (typeof parsed.info === 'object' && parsed.info?.playerState === 0) return true
    }
    return false
  } catch {
    return false
  }
}

export function getSpotifyEmbedUrl(url: string) {
  const match = url.match(/spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/)
  if (!match) return null
  return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`
}

export function platformLabel(platform: MusicPlatform) {
  switch (platform) {
    case 'youtube': return 'YouTube'
    case 'spotify': return 'Spotify'
    case 'apple': return 'Apple Music'
    default: return '링크'
  }
}

export function platformEmoji(platform: MusicPlatform) {
  switch (platform) {
    case 'youtube': return '▶️'
    case 'spotify': return '🟢'
    case 'apple': return '🍎'
    default: return '🎵'
  }
}
