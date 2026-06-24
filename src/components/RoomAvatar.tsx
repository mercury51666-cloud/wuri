interface RoomAvatarProps {
  photoURL?: string
  name?: string
  emoji?: string
  className?: string
}

export default function RoomAvatar({ photoURL, name, emoji, className = 'w-12 h-12' }: RoomAvatarProps) {
  const base = `${className} rounded-xl shrink-0 overflow-hidden border border-violet-200 dark:border-violet-500/20`

  if (photoURL) {
    return <img src={photoURL} alt={name ?? '방'} className={`${base} object-cover`} />
  }

  if (emoji) {
    return (
      <div className={`${base} bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center text-2xl`}>
        {emoji}
      </div>
    )
  }

  return (
    <div className={`${base} bg-gradient-to-br from-violet-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg`}>
      {(name?.trim()[0] ?? '?').toUpperCase()}
    </div>
  )
}
