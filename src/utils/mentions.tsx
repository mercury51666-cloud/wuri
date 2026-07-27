import type { ReactNode } from 'react'

export function parseMentionIds(
  text: string,
  profiles: Record<string, { displayName?: string }>,
): string[] {
  const ids: string[] = []
  for (const [uid, p] of Object.entries(profiles)) {
    const name = (p.displayName ?? '').trim()
    if (name && text.includes(`@${name}`)) ids.push(uid)
  }
  return [...new Set(ids)]
}

export function renderTextWithMentions(text: string, amIMentioned?: boolean): ReactNode {
  if (!text.includes('@')) return text
  const parts = text.split(/(@[^\s@]+)/g)
  return parts.map((part, i) => {
    if (!part.startsWith('@')) return <span key={i}>{part}</span>
    return (
      <span
        key={i}
        className={`font-bold ${amIMentioned ? 'bg-amber-200/80 dark:bg-amber-500/30 px-0.5 rounded' : 'text-amber-600 dark:text-amber-400'}`}
      >
        {part}
      </span>
    )
  })
}
