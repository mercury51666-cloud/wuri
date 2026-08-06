import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc, arrayUnion, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { awardMissionPoints } from '../utils/roomPoints'
import { postRankEvent } from '../utils/rankEvents'

// 미션 구성(OOTD+노래)이 예전 버전(랜덤 물건 찾기)과 호환되지 않으므로 버전을 못박아서
// 문서 키에 넣는다 — 같은 날짜 안에서 미션 내용이 바뀌어도 예전 데이터가 새 미션 칸에
// 잘못 섞여 보이지 않고, cleanupOldMissions가 자동으로 지워준다.
const MISSION_VERSION = 'v2'

function missionDocId(today: string) {
  return `photoMission_${MISSION_VERSION}_${today}`
}

async function cleanupOldMissions(roomId: string, today: string) {
  try {
    const metaRef = collection(db, 'rooms', roomId, 'meta')
    const snapshot = await getDocs(metaRef)
    const currentId = missionDocId(today)
    const deletions = snapshot.docs
      .filter((d) => d.id.startsWith('photoMission_') && d.id !== currentId)
      .map((d) => deleteDoc(d.ref))
    await Promise.all(deletions)
  } catch {
    // 무시
  }
}

const MISSIONS = [
  { emoji: '👗', theme: '오늘의 OOTD', type: 'photo' as const, notifyLabel: 'OOTD' },
  { emoji: '🎵', theme: '오늘의 추천 노래', type: 'song' as const, notifyLabel: '오늘의 추천곡' },
]

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
  url?: string
  songTitle?: string
  songArtist?: string
}

interface MissionData {
  date: string
  uploads: Upload[]
}

interface Props {
  roomId: string
}

async function updateStreak(roomId: string, userId: string, today: string) {
  const ref = doc(db, 'rooms', roomId, 'streaks', userId)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? snap.data() : { dates: [], streak: 0 }
  const dates: string[] = existing.dates ?? []
  if (dates.includes(today)) return existing.streak as number

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)
  const newStreak = dates.includes(yStr) ? (existing.streak as number) + 1 : 1

  await setDoc(ref, { dates: arrayUnion(today), streak: newStreak }, { merge: true })
  return newStreak
}

export default function DailyMission({ roomId }: Props) {
  const { user } = useAuthState()
  const [data, setData] = useState<MissionData | null>(null)
  const [uploading, setUploading] = useState<number | null>(null)
  const [streak, setStreak] = useState(0)
  const [pointToast, setPointToast] = useState('')
  const [songArtist, setSongArtist] = useState('')
  const [songTitle, setSongTitle] = useState('')
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const today = new Date().toISOString().slice(0, 10)
  const missions = MISSIONS

  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'rooms', roomId, 'streaks', user.uid)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setStreak(snap.data().streak ?? 0)
    })
  }, [roomId, user])

  useEffect(() => {
    cleanupOldMissions(roomId, today)
    const ref = doc(db, 'rooms', roomId, 'meta', missionDocId(today))
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setData(snap.data() as MissionData)
      else setData({ date: today, uploads: [] })
    })
  }, [roomId, today])

  const myUploads = new Set(
    (data?.uploads ?? []).filter((u) => u.userId === user?.uid).map((u) => u.missionIdx)
  )

  const submitMission = async (missionIdx: number, extra: Partial<Upload>) => {
    if (!user) return
    const alreadyDone = myUploads.has(missionIdx)
    const ref = doc(db, 'rooms', roomId, 'meta', missionDocId(today))
    await setDoc(ref, {
      date: today,
      uploads: arrayUnion({
        missionIdx,
        userId: user.uid,
        userName: user.displayName ?? user.email ?? '익명',
        ...extra,
      }),
    }, { merge: true })

    const currentUploads = new Set(
      (data?.uploads ?? []).filter((u) => u.userId === user.uid).map((u) => u.missionIdx)
    )
    currentUploads.add(missionIdx)
    if (currentUploads.size >= MISSIONS.length) {
      await updateStreak(roomId, user.uid, today)
    }

    if (!alreadyDone) {
      const userName = user.displayName ?? user.email ?? '익명'
      const result = await awardMissionPoints(
        roomId,
        user.uid,
        userName,
        today,
        currentUploads.size >= MISSIONS.length,
      )
      setPointToast(`+${result.gained}점 · ${result.label}`)
      setTimeout(() => setPointToast(''), 2500)

      const mission = MISSIONS[missionIdx]
      postRankEvent(
        roomId,
        { uid: user.uid, name: userName, photoURL: user.photoURL },
        'mission',
        `${userName}님이 ${mission.notifyLabel} 미션을 완료하였습니다 ${mission.emoji}`,
      ).catch(() => {})
    }
  }

  const handleUpload = async (missionIdx: number, file: File) => {
    setUploading(missionIdx)
    try {
      const url = await uploadToCloudinary(file)
      await submitMission(missionIdx, { url })
    } catch {
      alert('업로드 실패! Cloudinary 설정을 확인해주세요.')
    } finally {
      setUploading(null)
    }
  }

  const handleSongSubmit = async (missionIdx: number) => {
    if (!songArtist.trim() || !songTitle.trim()) return
    setUploading(missionIdx)
    try {
      await submitMission(missionIdx, {
        songArtist: songArtist.trim(),
        songTitle: songTitle.trim(),
      })
      setSongArtist('')
      setSongTitle('')
    } catch {
      alert('등록 실패! 잠시 후 다시 시도해주세요.')
    } finally {
      setUploading(null)
    }
  }

  const completedAll = myUploads.size >= MISSIONS.length

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-3xl p-5 border border-amber-100 dark:border-amber-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-full">
            오늘의 미션
          </span>
          <span className="text-xs text-gray-400">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="flex items-center gap-1 text-sm font-black text-orange-500 dark:text-orange-400">
              🔥 {streak}일
            </span>
          )}
          {completedAll && (
            <span className="text-xs font-bold text-green-600 dark:text-green-400">🎉 완료!</span>
          )}
          {pointToast && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">{pointToast}</span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        오늘의 코디 사진과 추천 노래를 공유해봐요!
      </p>

      <div className="flex flex-col gap-3">
        {missions.map((mission, idx) => {
          const missionUploads = (data?.uploads ?? []).filter((u) => u.missionIdx === idx)
          const myDone = myUploads.has(idx)
          const isUploading = uploading === idx

          return (
            <div key={idx} className="bg-white dark:bg-white/5 rounded-2xl p-3 border border-amber-100 dark:border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{mission.emoji}</span>
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{mission.theme}</span>
                  {myDone && <span className="text-xs text-green-500 font-bold">✓ 완료</span>}
                </div>
                {!myDone && mission.type === 'photo' && (
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

              {!myDone && mission.type === 'song' && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value)}
                      placeholder="가수"
                      className="input-field flex-1 text-sm"
                      style={{ fontSize: '16px' }}
                    />
                    <input
                      type="text"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      placeholder="노래 제목"
                      className="input-field flex-1 text-sm"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  <button
                    onClick={() => handleSongSubmit(idx)}
                    disabled={isUploading || !songArtist.trim() || !songTitle.trim()}
                    className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl font-bold transition-colors disabled:opacity-50 self-end"
                  >
                    {isUploading ? '등록 중...' : '🎵 추천하기'}
                  </button>
                </div>
              )}

              {missionUploads.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {missionUploads.map((upload, i) =>
                    upload.url ? (
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
                    ) : (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-full px-3 py-1.5"
                      >
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                          {upload.songArtist} - {upload.songTitle}
                        </span>
                        <span className="text-[10px] text-gray-400">{upload.userName.slice(0, 2)}</span>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {MISSIONS.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              myUploads.has(i) ? 'bg-amber-500' : 'bg-amber-100 dark:bg-amber-900/40'
            }`}
          />
        ))}
        <span className="text-xs text-gray-400 ml-1">{myUploads.size}/{MISSIONS.length}</span>
      </div>
    </div>
  )
}
