interface PhotoItem {
  id: string
  imageURL?: string
  authorName: string
  createdAt: { seconds: number } | null
}

interface Props {
  messages: PhotoItem[]
  onPhotoClick: (url: string) => void
}

export default function PhotoGallery({ messages, onPhotoClick }: Props) {
  const photos = messages.filter((m): m is PhotoItem & { imageURL: string } => !!m.imageURL)

  const formatDate = (ts: { seconds: number } | null) => {
    if (!ts) return ''
    return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center text-3xl">🖼️</div>
        <p className="font-semibold text-gray-500 dark:text-gray-400">공유된 사진이 없어요</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 text-center">채팅에서 사진을 보내면<br />여기에 모여요</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 dark:text-gray-500 px-1">총 {photos.length}장</p>
      <div className="grid grid-cols-3 gap-1.5">
        {[...photos].reverse().map((photo) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onPhotoClick(photo.imageURL)}
            className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-white/5 active:scale-95 transition-transform"
          >
            <img
              src={photo.imageURL}
              alt={`${photo.authorName}의 사진`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1.5 pt-4">
              <p className="text-[10px] text-white font-medium truncate">{photo.authorName}</p>
              <p className="text-[9px] text-white/70">{formatDate(photo.createdAt)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
