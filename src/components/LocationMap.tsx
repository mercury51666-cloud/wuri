import { useState, useEffect } from 'react'
import { doc, onSnapshot, setDoc, deleteDoc, collection } from 'firebase/firestore'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import 'leaflet/dist/leaflet.css'

// Leaflet 기본 마커 아이콘 수정
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface LocationData {
  userId: string
  userName: string
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
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const ref = collection(db, 'rooms', roomId, 'locations')
    return onSnapshot(ref, (snap) => {
      const now = Date.now()
      const locs = snap.docs
        .map((d) => d.data() as LocationData)
        .filter((l) => now - l.updatedAt < 1000 * 60 * 30)
      setLocations(locs)
      if (user) {
        const mine = locs.find((l) => l.userId === user.uid)
        setSharing(!!mine)
      }
    })
  }, [roomId, user])

  const startSharing = () => {
    if (!user) return
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setMyLocation({ lat, lng })
        await setDoc(doc(db, 'rooms', roomId, 'locations', user.uid), {
          userId: user.uid,
          userName: user.displayName ?? user.email ?? '친구',
          lat,
          lng,
          updatedAt: Date.now(),
        })
        setLoading(false)
      },
      () => {
        alert('위치 정보를 가져올 수 없어요. 브라우저 위치 권한을 허용해주세요.')
        setLoading(false)
      }
    )
  }

  const stopSharing = async () => {
    if (!user) return
    await deleteDoc(doc(db, 'rooms', roomId, 'locations', user.uid))
    setMyLocation(null)
  }

  const center = locations.length > 0
    ? { lat: locations[0].lat, lng: locations[0].lng }
    : myLocation ?? { lat: 37.5665, lng: 126.9780 }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
        <div>
          <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">📍 멤버 위치</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {locations.length > 0 ? `${locations.length}명 공유 중` : '공유 중인 멤버 없음'}
          </p>
        </div>
        <button
          onClick={sharing ? stopSharing : startSharing}
          disabled={loading}
          className={`text-xs font-bold px-4 py-2 rounded-xl transition-colors ${
            sharing
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200'
              : 'bg-violet-500 hover:bg-violet-600 text-white'
          } disabled:opacity-50`}
        >
          {loading ? '위치 확인 중...' : sharing ? '🔴 공유 끄기' : '🟢 내 위치 공유'}
        </button>
      </div>

      {locations.length > 0 ? (
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: '300px', width: '100%' }}
          key={locations.map((l) => l.userId).join(',')}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {locations.map((loc) => (
            <Marker key={loc.userId} position={[loc.lat, loc.lng]}>
              <Popup>
                <div className="text-sm font-bold">{loc.userName}</div>
                <div className="text-xs text-gray-500">
                  {new Date(loc.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 업데이트
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      ) : (
        <div className="h-40 flex flex-col items-center justify-center text-gray-400 gap-2">
          <span className="text-3xl">🗺️</span>
          <p className="text-sm">위치를 공유하면 여기에 지도가 나타나요</p>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400">위치는 30분 후 자동으로 사라져요</p>
      </div>
    </div>
  )
}
