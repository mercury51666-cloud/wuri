async function readCloudinaryError(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data?.error?.message || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData },
  )
  if (!res.ok) throw new Error(await readCloudinaryError(res))
  const data = await res.json()
  return data.secure_url as string
}

function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

// Cloudinary는 오디오 파일을 별도 리소스 타입 없이 video/upload 엔드포인트로 받는다.
// MediaRecorder가 만드는 Blob은 파일명이 없어서(기본값 "blob"), 확장자 없이 올리면
// 포맷을 못 알아채 업로드가 거부되는 경우가 있어 mimeType에 맞는 확장자를 붙여준다.
export async function uploadAudioToCloudinary(blob: Blob): Promise<string> {
  const formData = new FormData()
  const ext = extensionForMime(blob.type || 'audio/webm')
  formData.append('file', blob, `voice-message.${ext}`)
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: 'POST', body: formData },
  )
  if (!res.ok) throw new Error(await readCloudinaryError(res))
  const data = await res.json()
  return data.secure_url as string
}
