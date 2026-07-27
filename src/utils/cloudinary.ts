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
  // 아이폰(사파리)은 오디오만 녹음해도 실제로는 mp4(ISO base media) 컨테이너를 만든다.
  // .m4a로 표시하면 Cloudinary가 m4a 전용 브랜드 검사에 걸려 "Unsupported video
  // format or file"로 거부하는 경우가 있어, 더 범용적으로 인식되는 mp4로 올린다.
  if (mime.includes('mp4')) return 'mp4'
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
