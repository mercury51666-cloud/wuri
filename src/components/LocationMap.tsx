import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { doc, getDoc, onSnapshot, setDoc, deleteDoc, collection } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { reverseGeocodeKo } from '../utils/reverseGeocodeKo'
import { postRankEvent } from '../utils/rankEvents'
import { requestMessagePush } from '../hooks/useFcm'
import 'leaflet/dist/leaflet.css'

const MAP_TILES = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 기여자',
} as const

const COLORS = ['#FF6B9D', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#FB7185', '#22D3EE', '#A3E635']

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function makeZenlyIcon(
  photoURL: string,
  name: string,
  color: string,
  isMe: boolean,
  placeName?: string
) {
  const shortName = name.length > 6 ? `${name.slice(0, 5)}…` : name
  const initials = name.slice(0, 1)
  const inner = photoURL
    ? `<img src="${escapeHtml(photoURL)}" alt="" />`
    : `<span class="zenly-marker-initial">${escapeHtml(initials)}</span>`
  const meRing = isMe ? '<span class="zenly-marker-me-ring"></span>' : ''
  const placeHtml = placeName
    ? `<span class="zenly-marker-place">${escapeHtml(placeName)}</span>`
    : ''
  const hasPlace = Boolean(placeName)

  return L.divIcon({
    className: 'zenly-marker-leaflet',
    html: `
      <div class="zenly-marker-wrap" style="--zenly-color:${color}">
        <div class="zenly-marker-stack">
          <span class="zenly-marker-pulse"></span>
          ${meRing}
          <div class="zenly-marker-avatar">${inner}</div>
        </div>
        <span class="zenly-marker-name">${escapeHtml(shortName)}</span>
        ${placeHtml}
      </div>
    `,
    iconSize: [88, hasPlace ? 96 : 78],
    iconAnchor: [44, hasPlace ? 58 : 52],
  })
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '방금'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return '오래 전'
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng, map])
  return null
}

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

interface LocationData {
  userId: string
  userName: string
  photoURL: string
  lat: number
  lng: number
  updatedAt: number
}

interface Props {
  roomId: string
  visible?: boolean
}

export default function LocationMap({ roomId, visible = true }: Props) {
  const { user } = useAuthState()
  const { dark } = useTheme()
  const { toast } = useToast()
  const [sharing, setSharing] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const [locations, setLocations] = useState<LocationData[]>([])
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [myCenter, setMyCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [, setTick] = useState(0)
  const watchIdRef = useRef<number | null>(null)
  const notifiedSharingRef = useRef(false)

  useEffect(() => {
    const ref = collection(db, 'rooms', roomId, 'locations')
    return onSnapshot(ref, (snap) => {
      const now = Date.now()
      setLocations(
        snap.docs
          .map((d) => d.data() as LocationData)
          .filter((l) => now - l.updatedAt < 1000 * 60 * 60)
      )
    })
  }, [roomId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      for (const loc of locations) {
        if (cancelled) break
        const place = await reverseGeocodeKo(loc.lat, loc.lng)
        if (!cancelled) {
          setPlaceNames((prev) =>
            prev[loc.userId] === place ? prev : { ...prev, [loc.userId]: place }
          )
        }
      }
    })()
    return () => { cancelled = true }
  }, [locations])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (user) {
      const mine = locations.find((l) => l.userId === user.uid)
      setSharing(!!mine)
    }
  }, [locations, user])

  // 선택했던 친구가 위치 공유를 끄면 선택을 풀어서 엉뚱한 좌표를 계속 따라가지 않게 한다.
  useEffect(() => {
    if (selectedUserId && !locations.some((l) => l.userId === selectedUserId)) {
      setSelectedUserId(null)
    }
  }, [locations, selectedUserId])

  const focusOnUser = (loc: LocationData) => {
    setSelectedUserId(loc.userId)
    const map = mapRef.current
    if (!map) return
    map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
  }

  const startSharing = () => {
    if (!user) return
    setLoading(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setMyCenter({ lat, lng })
        setLoading(false)
        setSharing(true)
        await setDoc(doc(db, 'rooms', roomId, 'locations', user.uid), {
          userId: user.uid,
          userName: user.displayName ?? user.email?.split('@')[0] ?? '친구',
          photoURL: user.photoURL ?? '',
          lat,
          lng,
          updatedAt: Date.now(),
        })

        if (!notifiedSharingRef.current) {
          notifiedSharingRef.current = true
          const userName = user.displayName ?? user.email?.split('@')[0] ?? '친구'
          const text = `${userName}님이 위치를 공유하기 시작하였습니다 📍`
          postRankEvent(roomId, { uid: user.uid, name: userName, photoURL: user.photoURL }, 'location', text).catch(() => {})
          getDoc(doc(db, 'rooms', roomId)).then((roomSnap) => {
            requestMessagePush({
              roomId,
              senderId: user.uid,
              senderName: userName,
              roomName: roomSnap.exists() ? (roomSnap.data() as { name?: string }).name : undefined,
              text,
            })
          }).catch(() => {
            requestMessagePush({ roomId, senderId: user.uid, senderName: userName, text })
          })
        }
      },
      () => {
        toast('위치 권한을 켜주면 친구들이 볼 수 있어요 📍')
        setLoading(false)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    )
  }

  const stopSharing = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (user) await deleteDoc(doc(db, 'rooms', roomId, 'locations', user.uid))
    setSharing(false)
    setMyCenter(null)
    notifiedSharingRef.current = false
    toast('위치 숨김! 이제 안 보여요 👻')
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 150)
    }
  }, [visible])

  const myLoc = user ? locations.find((l) => l.userId === user.uid) : null
  const focusLoc = (selectedUserId && locations.find((l) => l.userId === selectedUserId)) || myLoc
  const center = myLoc
    ? { lat: myLoc.lat, lng: myLoc.lng }
    : locations[0]
    ? { lat: locations[0].lat, lng: locations[0].lng }
    : myCenter ?? { lat: 37.5665, lng: 126.9780 }

  const colorMap: Record<string, string> = {}
  locations.forEach((l, i) => { colorMap[l.userId] = COLORS[i % COLORS.length] })

  const sortedLocations = [...locations].sort((a, b) => {
    if (a.userId === user?.uid) return -1
    if (b.userId === user?.uid) return 1
    return b.updatedAt - a.updatedAt
  })

  const frameClass = dark ? 'zenly-map-frame-dark' : 'zenly-map-frame-light'

  return (
    <div className="zenly-map-shell">
      <div className="zenly-map-deco zenly-map-deco-a">🌸</div>
      <div className="zenly-map-deco zenly-map-deco-b">✨</div>

      <div className="zenly-map-header">
        <div>
          <p className="zenly-map-title">
            <span className="zenly-map-title-emoji">🫧</span>
            친구 지도
          </p>
          <p className="zenly-map-subtitle">
            {sharing
              ? myLoc && placeNames[myLoc.userId]
                ? `지금 ${placeNames[myLoc.userId]}에 있어요`
                : '지금 내 위치를 친구들에게 보여주는 중이에요'
              : locations.length > 0
              ? `${locations.length}명이 근처에 있어요`
              : '아직 아무도 안 왔어요… 먼저 공유해볼까?'}
          </p>
        </div>
        <button
          type="button"
          onClick={sharing ? stopSharing : startSharing}
          disabled={loading}
          className={`zenly-share-btn ${sharing ? 'zenly-share-btn-off' : ''}`}
        >
          {loading ? '잠깐만…' : sharing ? '👻 숨기기' : '📍 공유하기'}
        </button>
      </div>

      <div className={`zenly-map-frame ${frameClass}`}>
        <div className="zenly-map-inner">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={15}
            style={{ height: '360px', width: '100%' }}
            ref={mapRef}
            zoomControl={false}
          >
            <TileLayer attribution={MAP_TILES.attribution} url={MAP_TILES.url} />
            <MapResizer />
            {focusLoc && <RecenterMap lat={focusLoc.lat} lng={focusLoc.lng} />}
            {locations.map((loc) => (
              <Marker
                key={`${loc.userId}-${placeNames[loc.userId] ?? ''}`}
                position={[loc.lat, loc.lng]}
                icon={makeZenlyIcon(
                  loc.photoURL,
                  loc.userName,
                  colorMap[loc.userId] ?? COLORS[0],
                  loc.userId === user?.uid,
                  placeNames[loc.userId]
                )}
                eventHandlers={{ click: () => focusOnUser(loc) }}
              />
            ))}
          </MapContainer>

          {locations.length === 0 && !sharing && (
            <div className="zenly-map-empty">
              <span className="zenly-map-empty-emoji">🗺️</span>
              <p>여기서 친구들 위치를 볼 수 있어요</p>
              <p className="zenly-map-empty-hint">동·구 이름까지 한글로 보여줘요!</p>
            </div>
          )}
        </div>
      </div>

      {sortedLocations.length > 0 && (
        <div className="zenly-friends-strip">
          <p className="zenly-friends-label">📍 지금 여기 있는 친구</p>
          <div className="zenly-friends-scroll">
            {sortedLocations.map((loc) => (
              <button
                key={loc.userId}
                type="button"
                onClick={() => focusOnUser(loc)}
                className={`zenly-friend-chip ${loc.userId === user?.uid ? 'zenly-friend-chip-me' : ''} ${loc.userId === selectedUserId ? 'zenly-friend-chip-selected' : ''}`}
                style={{ '--chip-color': colorMap[loc.userId] } as CSSProperties}
              >
                <div
                  className="zenly-friend-avatar"
                  style={{ backgroundColor: colorMap[loc.userId] }}
                >
                  {loc.photoURL ? (
                    <img src={loc.photoURL} alt="" />
                  ) : (
                    <span>{loc.userName.slice(0, 1)}</span>
                  )}
                  <span className="zenly-friend-dot" />
                </div>
                <span className="zenly-friend-name">
                  {loc.userId === user?.uid ? '나' : loc.userName}
                </span>
                <span className="zenly-friend-place">
                  {placeNames[loc.userId] ?? '찾는 중…'}
                </span>
                <span className="zenly-friend-time">{timeAgo(loc.updatedAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
