import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'

const OBJECT_POOL = [
  { emoji: '🔴', theme: '빨간 물건' },
  { emoji: '🔵', theme: '파란 물건' },
  { emoji: '🟡', theme: '노란 물건' },
  { emoji: '🟢', theme: '초록 물건' },
  { emoji: '⚪', theme: '하얀 물건' },
  { emoji: '⚫', theme: '검은 물건' },
  { emoji: '🔲', theme: '네모난 것' },
  { emoji: '⭕', theme: '동그란 것' },
  { emoji: '📱', theme: '전자기기' },
  { emoji: '🍽️', theme: '먹을 것' },
  { emoji: '👟', theme: '신발' },
  { emoji: '📚', theme: '책 또는 공책' },
  { emoji: '🌿', theme: '식물' },
  { emoji: '🪟', theme: '창문 밖 풍경' },
  { emoji: '☁️', theme: '하늘' },
  { emoji: '💡', theme: '빛나는 것' },
  { emoji: '🪑', theme: '앉을 수 있는 것' },
  { emoji: '🧃', theme: '음료' },
  { emoji: '🎒', theme: '가방' },
  { emoji: '🕐', theme: '시계 또는 시간' },
  { emoji: '🌸', theme: '꽃 또는 꽃무늬' },
  { emoji: '🪞', theme: '내 손 또는 발' },
  { emoji: '🖼️', theme: '그림 또는 포스터' },
  { emoji: '🧸', theme: '귀여운 것' },
  { emoji: '🌙', theme: '지금 내 주변' },
]

function getTodayMissions() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  const indices = [
    dayOfYear % OBJECT_POOL.length,
    (dayOfYear + 7) % OBJECT_POOL.length,
    (dayOfYear + 17) % OBJECT_POOL.length,
  ]
  return indices.map((i) => OBJECT_POOL[i])
}

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary 설정이 없어요')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  return data.secure_url as string
}

interface Upload {
  missionIdx: number
  userId: string
  userName: string
  url: string
}

interface MissionData {
  date: string
  uploads: Upload[]
}

interface Props {
  roomId: string
}

export default function DailyMission({ roomId }: Props) {
  const { user } = useAuthState()
  const [data, setData] = useState<MissionData | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const today = new Date().toISOString().slice(0, 10)
  const missions = getTodayMissions()

  useEffect(() => {
    const ref = doc(db, 'rooms', roomId, 'meta', `photoMission_${today}`)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setData(snap.data() as MissionData)
      else setData({ date: today, uploads: [] })
    })
  }, [roomId, today])

  const handleUpload = async (missionIdx: number, file: File) => {
    if (!user) return
    setUploading(missionIdx)
    try {
      const url = await uploadToCloudinary(file)
      const ref = doc(db, 'rooms', roomId, 'meta', `photoMission_${today}`)
      await setDoc(ref, {
        date: today,
        uploads: arrayUnion({
          missionIdx,
          userId: user.uid,
          userName: user.displayName ?? user.email ?? '익명',
          url,
        }),
      }, { merge: true })
    } catch {
      alert('업로드 실패! Cloudinary 설정을 확인해주세요.')
    } finally {
      setUploading(null)
    }
  }

  const myUploads = new Set(
    (data?.uploads ?? []).filter((u) => u.userId === user?.uid).map((u) => u.missionIdx)
  )
  const completedAll = myUploads.size >= 3

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-3xl p-5 border border-amber-100 dark:border-amber-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
            오늘의 사진 미션
          </span>
          <span className="text-xs text-gray-400">{today}</span>
        </div>
        {completedAll && (
          <span className="text-xs font-bold text-green-600 dark:text-green-400">🎉 오늘 미션 완료!</span>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        아래 3가지 물건을 찾아서 사진 찍어 올려봐요!
      </p>

      <div className="flex flex-col gap-3">
        {missions.map((mission, idx) => {
          const missionUploads = (data?.uploads ?? []).filter((u) => u.missionIdx === idx)
          const myDone = myUploads.has(idx)
          const isUploading = uploading === idx

          return (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl p-3 border border-amber-100 dark:border-amber-800/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{mission.emoji}</span>
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{mission.theme}</span>
                  {myDone && <span className="text-xs text-green-500 font-bold">✓ 완료</span>}
                </div>
                {!myDone && (
                  <>
                    <button
                      onClick={() => fileRefs[idx].current?.click()}
                      disabled={isUploading}
                      className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl font-bold transition-colors disabled:opacity-50"
                    >
                      {isUploading ? '올리는 중...' : '📷 찍어서 올리기'}
                    </button>
                    <input
                      ref={fileRefs[idx]}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(idx, file)
                        e.target.value = ''
                      }}
                    />
                  </>
                )}
              </div>

              {missionUploads.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {missionUploads.map((upload, i) => (
                    <div key={i} className="relative">
                      <img
                        src={upload.url}
                        alt={mission.theme}
                        className="w-16 h-16 object-cover rounded-xl border-2 border-amber-200 dark:border-amber-700"
                      />
                      <span className="absolute -bottom-1 -right-1 text-xs bg-white dark:bg-gray-700 rounded-full px-1 border border-gray-200 dark:border-gray-600">
                        {upload.userName.slice(0, 2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              myUploads.has(i) ? 'bg-amber-500' : 'bg-amber-100 dark:bg-amber-900/40'
            }`}
          />
        ))}
        <span className="text-xs text-gray-400 ml-1">{myUploads.size}/3</span>
      </div>
    </div>
  )
}
