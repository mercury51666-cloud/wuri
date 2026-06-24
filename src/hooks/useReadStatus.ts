export function toMs(ts: { seconds: number } | null | undefined): number {
  if (!ts?.seconds) return 0
  return ts.seconds * 1000
}

/** 내가 안 읽은 상대 메시지 수 */
export function countUnreadMessages(
  messages: { authorId: string; createdAt: { seconds: number } | null }[],
  myLastReadMs: number,
  myUid: string,
): number {
  return messages.filter(
    (m) => m.authorId !== myUid && toMs(m.createdAt) > myLastReadMs,
  ).length
}

/** 내 메시지를 아직 안 읽은 멤버 수 (카톡 스타일) */
export function countUnreadByOthers(
  msg: { authorId: string; createdAt: { seconds: number } | null },
  memberIds: string[],
  memberReadAt: Record<string, number>,
): number {
  const msgTime = toMs(msg.createdAt)
  if (!msgTime) return 0
  return memberIds
    .filter((id) => id !== msg.authorId)
    .filter((id) => (memberReadAt[id] ?? 0) < msgTime)
    .length
}
