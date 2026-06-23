import { useState, useRef } from 'react'
import { updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'

async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary 설정 없음')
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

interface Props {
  onClose: () => void
}

export default function ProfileModal({ onClose }: Props) {
  const { user } = useAuthState()
  const [name, setName] = useState(user?.displayName ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<string | null>(user?.photoURL ?? null)
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null)
  const [resetPhoto, setResetPhoto] = useState(false)

  const handleResetPhoto = () => {
    setPreview(null)
    setNewPhotoUrl(null)
    setResetPhoto(true)
  }
  const fileRef = useRef<HTMLInputElement>(null)

  const handlePhoto = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadToCloudinary(file)
      setPreview(url)
      setNewPhotoUrl(url)
    } catch {
      alert('사진 업로드 실패! Cloudinary 설정을 확인해주세요.')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const photoURL = resetPhoto ? '' : (newPhotoUrl ?? (user.photoURL ?? ''))
      const displayName = name.trim() || (user.email?.split('@')[0] ?? '친구')
      await updateProfile(auth.currentUser!, { displayName, photoURL })
      await setDoc(doc(db, 'users', user.uid), { displayName, photoURL }, { merge: true })
      onClose()
    } catch {
      alert('저장 실패!')
    } finally {
      setSaving(false)
    }
  }

  const initials = (user?.displayName ?? user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg text-gray-800 dark:text-gray-100">프로필 편집</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
        </div>

        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="relative">
            {preview ? (
              <img src={preview} alt="프로필" className="w-24 h-24 rounded-full object-cover border-4 border-violet-200 dark:border-violet-700" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white text-2xl font-bold border-4 border-violet-200">
                {initials}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-8 h-8 bg-violet-500 hover:bg-violet-600 text-white rounded-full flex items-center justify-center text-sm shadow-lg disabled:opacity-50"
            >
              {uploading ? '⏳' : '📷'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400">{uploading ? '업로드 중...' : '사진을 눌러 변경'}</p>
            {(preview || user?.photoURL) && !resetPhoto && (
              <button
                onClick={handleResetPhoto}
                className="text-xs text-red-400 hover:text-red-600 underline"
              >
                기본값으로
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePhoto(file)
              e.target.value = ''
            }}
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">닉네임</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임 입력"
            maxLength={12}
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
