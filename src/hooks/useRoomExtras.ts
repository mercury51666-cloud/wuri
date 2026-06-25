import { useEffect, useState, useRef, useCallback } from 'react'
import {
  doc, collection, addDoc, setDoc, updateDoc,
  serverTimestamp, arrayUnion, arrayRemove, getDoc, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { User } from 'firebase/auth'
import { getRankLevel } from '../utils/rankSystem'
import { birthdayKey, READ_NUDGE_MS } from '../utils/roomFeatures'

export interface RoomMetaState {
  birthdays: { userId: string; name: string }[]
}

export function useRoomExtras(
  roomId: string | undefined,
  user: User | null,
  roomMemberIds: string[],
  memberProfiles: Record<string, { displayName: string }>,
  memberReadAt: Record<string, number>,
  messages: { id: string; authorId: string; authorName: string; text: string; createdAt: { seconds: number } | null }[],
  toast: (msg: string) => void,
) {
  const [meta, setMeta] = useState<RoomMetaState>({ birthdays: [] })
  const nudgedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!roomId) return
    const t = setInterval(async () => {
      const snap = await getDocs(collection(db, 'rooms', roomId, 'scheduledMessages'))
      const now = Date.now()
      for (const d of snap.docs) {
        const data = d.data()
        if (data.sent || !data.sendAt || data.sendAt > now) continue
        await addDoc(collection(db, 'rooms', roomId, 'messages'), {
          text: data.text,
          authorId: data.authorId,
          authorName: data.authorName,
          authorPhotoURL: data.authorPhotoURL || '',
          createdAt: serverTimestamp(),
          mentions: data.mentions ?? [],
        })
        await updateDoc(d.ref, { sent: true })
      }
    }, 15000)
    return () => clearInterval(t)
  }, [roomId])

  useEffect(() => {
    if (!user) return
    const t = setInterval(() => {
      const now = Date.now()
      for (const msg of messages) {
        if (msg.authorId !== user.uid || !msg.createdAt || nudgedRef.current.has(msg.id)) continue
        const age = now - msg.createdAt.seconds * 1000
        if (age < READ_NUDGE_MS) continue
        const others = roomMemberIds.filter((id) => id !== user.uid)
        const unread = others.some((id) => (memberReadAt[id] ?? 0) < msg.createdAt!.seconds * 1000)
        if (unread) {
          nudgedRef.current.add(msg.id)
          toast(`📭 "${msg.text.slice(0, 20)}..." 아직 안 읽은 사람이 있어요`)
        }
      }
    }, 60000)
    return () => clearInterval(t)
  }, [messages, memberReadAt, roomMemberIds, user?.uid, toast])

  useEffect(() => {
    if (!roomMemberIds.length) return
    let cancelled = false
    ;(async () => {
      const bday = birthdayKey()
      const list: { userId: string; name: string }[] = []
      for (const uid of roomMemberIds) {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists() && snap.data().birthday === bday) {
          list.push({ userId: uid, name: memberProfiles[uid]?.displayName ?? '친구' })
        }
      }
      if (!cancelled) setMeta({ birthdays: list })
    })()
    return () => { cancelled = true }
  }, [roomMemberIds.join(','), memberProfiles])

  const saveBirthday = useCallback(async (birthday: string) => {
    if (!user) return
    await setDoc(doc(db, 'users', user.uid), { birthday }, { merge: true })
    toast('생일 저장! 🎂')
  }, [user, toast])

  const createPoll = useCallback(async (question: string, options: string[]) => {
    if (!user || !roomId || options.length < 2) return
    const votes: Record<string, string[]> = {}
    options.forEach((_, i) => { votes[String(i)] = [] })
    await addDoc(collection(db, 'rooms', roomId, 'messages'), {
      messageType: 'poll',
      pollQuestion: question,
      pollOptions: options,
      pollVotes: votes,
      text: question,
      authorId: user.uid,
      authorName: user.displayName || '친구',
      authorPhotoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
    })
    toast('투표 생성! 📊')
  }, [user, roomId, toast])

  const votePoll = useCallback(async (
    msgId: string,
    optionIdx: number,
    currentVotes: Record<string, string[]>,
    voterPoints: number,
  ) => {
    if (!user || !roomId) return
    const weight = getRankLevel(voterPoints) >= 3 ? 2 : 1
    const ref = doc(db, 'rooms', roomId, 'messages', msgId)
    const updates: Record<string, unknown> = {
      [`pollChoice.${user.uid}`]: optionIdx,
      [`pollWeight.${user.uid}`]: weight,
    }
    for (const [key, uids] of Object.entries(currentVotes)) {
      if (uids.includes(user.uid)) {
        updates[`pollVotes.${key}`] = arrayRemove(user.uid)
      }
    }
    updates[`pollVotes.${optionIdx}`] = arrayUnion(user.uid)
    await updateDoc(ref, updates)
  }, [user, roomId])

  const scheduleMessage = useCallback(async (text: string, sendAt: number, mentions: string[]) => {
    if (!user || !roomId) return
    await addDoc(collection(db, 'rooms', roomId, 'scheduledMessages'), {
      text,
      sendAt,
      mentions,
      authorId: user.uid,
      authorName: user.displayName || '친구',
      authorPhotoURL: user.photoURL || '',
      sent: false,
    })
    toast('메시지 예약! ⏰')
  }, [user, roomId, toast])

  return {
    meta,
    saveBirthday,
    createPoll,
    votePoll,
    scheduleMessage,
  }
}
