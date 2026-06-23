import { useState, useEffect, useRef } from 'react'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'

async function cleanupOldPhotos(roomId: string) {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const q = query(
      collection(db, 'rooms', roomId, 'photos'),
      where('createdAt', '<', Timestamp.fromDate(todayStart))
    )
    const snap = await getDocs(q)
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
  } catch {
    // 무시
  }
}

interface Photo {
  id: string
  url: string
  authorId: string
  authorName: string
  caption: string
  createdAt: { seconds: number } | null
}

interface Props {
  roomId: string
}

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary 설정이 없어요. .env 파일을 확인해주세요.')
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )
  const data = await res.json() as { secure_url: string }
  return data.secure_url
}

export default function PhotoFeed({ roomId }: Props) {
  const { user } = useAuthState()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 오늘 내가 이미 올렸는지 확인
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const alreadyPostedToday = photos.some(
    (p) =>
      p.authorId === user?.uid &&
      p.createdAt &&
      p.createdAt.seconds * 1000 >= todayStart.getTime()
  )

  useEffect(() => {
    cleanupOldPhotos(roomId)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const q = query(
      collection(db, 'rooms', roomId, 'photos'),
      where('createdAt', '>=', Timestamp.fromDate(todayStart)),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Photo)))
    })
  }, [roomId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleUpload = async () => {
    if (!selectedFile || !user) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadToCloudinary(selectedFile)
      await addDoc(collection(db, 'rooms', roomId, 'photos'), {
        url,
        caption: caption.trim(),
        authorId: user.uid,
        authorName: user.displayName || '친구',
        createdAt: serverTimestamp(),
      })
      setPreview(null)
      setSelectedFile(null)
      setCaption('')
    } catch {
      setError('업로드 실패했어요. Cloudinary 설정을 확인해주세요.')
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (ts: { seconds: number } | null) => {
    if (!ts) return ''
    const d = new Date(ts.seconds * 1000)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return '방금 전'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`
    return `${Math.floor(diff / 86400000)}일 전`
  }

  return (
    <div className="flex flex-col h-full">
      {/* 업로드 영역 */}
      <div className="p-4 border-b border-gray-100">
        {!preview ? (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={alreadyPostedToday}
            className={`w-full py-4 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors ${
              alreadyPostedToday
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-violet-300 text-violet-400 hover:border-violet-400 hover:bg-violet-50'
            }`}
          >
            <span className="text-3xl">📷</span>
            <span className="text-sm font-medium">
              {alreadyPostedToday ? '오늘의 사진은 이미 올렸어요 ✓' : '오늘의 사진 올리기'}
            </span>
            {!alreadyPostedToday && (
              <span className="text-xs text-gray-400">하루 1장, 지금 이 순간을 공유해요</span>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <img src={preview} alt="미리보기" className="w-full rounded-2xl max-h-64 object-cover" />
              <button
                onClick={() => { setPreview(null); setSelectedFile(null) }}
                className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full text-white text-sm flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="한 줄 남기기... (선택)"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-300 text-white font-bold rounded-xl"
            >
              {uploading ? '올리는 중...' : '공유하기 ✓'}
            </button>
          </div>
        )}
        <input type="file" accept="image/*" ref={fileRef} onChange={handleFileChange} className="hidden" />
      </div>

      {/* 사진 피드 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {photos.length === 0 ? (
          <div className="text-center py-12 text-gray-300">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm">아직 사진이 없어요</p>
            <p className="text-xs mt-1">첫 번째 사진을 올려보세요!</p>
          </div>
        ) : (
          photos.map((photo) => (
            <div key={photo.id} className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-violet-200 flex items-center justify-center text-sm font-bold text-violet-700">
                  {photo.authorName[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{photo.authorName}</p>
                  <p className="text-xs text-gray-400">{formatDate(photo.createdAt)}</p>
                </div>
              </div>
              <img src={photo.url} alt="사진" className="w-full" />
              {photo.caption && (
                <p className="px-4 py-3 text-sm text-gray-700">{photo.caption}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
