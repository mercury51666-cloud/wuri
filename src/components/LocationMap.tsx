import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, collection } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import 'leaflet/dist/leaflet.css'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeProfileIcon(photoURL: string, name: string, color: string) {
  const initials = name.slice(0, 2).toUpperCase()
  const inner = photoURL
    ? `<img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`
    : `<span style="color:white;font-size:13px;font-weight:bold;">${initials}</span>`
  return L.divIcon({
    className: '',
    html: `<div style="
      width:42px;height:42px;border-radius:50%;
      background:${color};border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      overflow:hidden;
    ">${inner}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -44],
  })
}

const COLORS = ['#8b5cf6','#ec4899','#3b82f6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16']

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  return `${Math.floor(diff / 3600)}시간 전`
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.setView([lat, lng], map.getZoom()) }, [lat, lng])
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
}

export default function LocationMap({ roomId }: Props) {
  const { user } = useAuthState()
  const [sharing, setSharing] = useState(false)
  const [locations, setLocations] = useState<LocationData[]>([])
  const [loading, setLoading] = useState(false)
  const [myCenter, setMyCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [, setTick] = useState(0)
  const watchIdRef = useRef<number | null>(null)

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
    const id = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (user) {
      const mine = locations.find((l) => l.userId === user.uid)
      setSharing(!!mine)
    }
  }, [locations, user])

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
      },
      () => {
        alert('위치 권한을 허용해주세요!')
        setLoading(false)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
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
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  const myLoc = user ? locations.find((l) => l.userId === user.uid) : null
  const center = myLoc
    ? { lat: myLoc.lat, lng: myLoc.lng }
    : locations[0]
    ? { lat: locations[0].lat, lng: locations[0].lng }
    : myCenter ?? { lat: 37.5665, lng: 126.9780 }

  const colorMap: Record<string, string> = {}
  locations.forEach((l, i) => { colorMap[l.userId] = COLORS[i % COLORS.length] })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700" style={{ isolation: 'isolate' }}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <div>
          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm flex items-center gap-1.5">
            📍 실시간 위치
            {sharing && (
              <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-normal">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                공유 중
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {locations.length > 0 ? `${locations.length}명 위치 공유 중` : '공유 중인 멤버 없음'}
          </p>
        </div>
        <button
          onClick={sharing ? stopSharing : startSharing}
          disabled={loading}
          className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
            sharing
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-violet-500 hover:bg-violet-600 text-white'
          } disabled:opacity-50`}
        >
          {loading ? '...' : sharing ? '끄기' : '🟢 위치 공유'}
        </button>
      </div>

      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        style={{ height: '320px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {myLoc && <RecenterMap lat={myLoc.lat} lng={myLoc.lng} />}
        {locations.map((loc) => (
          <Marker
            key={loc.userId}
            position={[loc.lat, loc.lng]}
            icon={makeProfileIcon(loc.photoURL, loc.userName, colorMap[loc.userId] ?? COLORS[0])}
          >
            <Popup>
              <div className="text-center min-w-[80px]">
                <p className="font-bold text-sm">{loc.userName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(loc.updatedAt)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {locations.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex gap-2 flex-wrap">
          {locations.map((loc) => (
            <div key={loc.userId} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: colorMap[loc.userId] }}
              />
              <span className="font-medium">{loc.userName}</span>
              <span className="text-gray-400">{timeAgo(loc.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
