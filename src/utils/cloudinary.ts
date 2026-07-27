export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData },
  )
  if (!res.ok) throw new Error('upload failed')
  const data = await res.json()
  return data.secure_url as string
}

// Cloudinary는 오디오 파일을 별도 리소스 타입 없이 video/upload 엔드포인트로 받는다.
export async function uploadAudioToCloudinary(blob: Blob): Promise<string> {
  const formData = new FormData()
  formData.append('file', blob)
  formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET)
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: 'POST', body: formData },
  )
  if (!res.ok) throw new Error('upload failed')
  const data = await res.json()
  return data.secure_url as string
}
