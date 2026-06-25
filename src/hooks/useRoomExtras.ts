import { useEffect, useState, useRef, useCallback } from 'react'
import {
  doc, collection, onSnapshot, addDoc, setDoc, updateDoc,
  serverTimestamp, arrayUnion, arrayRemove, getDoc, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { User } from 'firebase/auth'
import { postRankEvent } from '../utils/rankEvents'
import { randomReprimand, buildGuboText } from '../utils/reprimandTexts'
import {
  canMute, getRankName,
} from '../utils/rankPowers'
import { getRankLevel } from '../utils/rankSystem'
import { recordLoginStreak, updateDailyMvpMeta, setEquippedTitle } from '../utils/roomPoints'
import type { RoomRankData } from '../utils/roomPoints'
import {
  todayKey, birthdayKey, READ_NUDGE_MS, ROOM_THEMES, findLowestRankMembers,
} from '../utils/roomFeatures'
import type { RoomMute } from '../utils/rankPowers'

const REPRIMAND_MS = 30_000
const REBELLION_MS = 3_000
const THEME_MS = 60 * 60 * 1000

export interface RoomMetaState {
  mvp?: { userId: string; userName: string; score: number }
  weeklyChampion?: { userId: string; userName: string; title: string }
  groupMission?: { total: number; goal: number }
  roomTheme?: { accent: string; until: number; byUserName: string }
  hallOfFame: { weekKey: string; type: string; userName: string; value: number }[]
  birthdays: { userId: string; name: string }[]
}

export interface GuboPending {
  byUserName: string
  byRankName: string
}

export function useRoomExtras(
  roomId: string | undefined,
  user: User | null,
  roomMemberIds: string[],
  memberRanks: Record<string, RoomRankData>,
  memberProfiles: Record<string, { displayName: string }>,
  memberReadAt: Record<string, number>,
  messages: { id: string; authorId: string; authorName: string; text: string; createdAt: { seconds: number } | null }[],
  myMute: RoomMute | null,
  toast: (msg: string) => void,
) {
  const [meta, setMeta] = useState<RoomMetaState>({ hallOfFame: [], birthdays: [] })
  const [guboPending, setGuboPending] = useState<GuboPending | null>(null)
  const [loginStreak, setLoginStreak] = useState(0)
  const prevMuteRef = useRef<RoomMute | null>(null)
  const nudgedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!roomId) return
    const today = todayKey()
    return onSnapshot(collection(db, 'rooms', roomId, 'meta'), (snap) => {
      const next: RoomMetaState = { hallOfFame: [], birthdays: [] }
      snap.docs.forEach((d) => {
        const data = d.data()
        if (d.id === `mvp_${today}`) next.mvp = data as RoomMetaState['mvp']
        if (d.id.startsWith('weeklyChampion_')) next.weeklyChampion = data as RoomMetaState['weeklyChampion']
        if (d.id.startsWith('groupMission_')) next.groupMission = data as RoomMetaState['groupMission']
        if (d.id === 'roomTheme') next.roomTheme = data as RoomMetaState['roomTheme']
        if (d.id === 'hallOfFame') next.hallOfFame = (data.entries ?? []).slice(0, 10)
      })
      setMeta(next)
    })
  }, [roomId])

  useEffect(() => {
    if (!roomId || !user || !roomMemberIds.includes(user.uid)) return
    recordLoginStreak(roomId, user.uid, user.displayName || '친구').then(setLoginStreak).catch(() => {})
  }, [roomId, user?.uid, roomMemberIds.join(',')])

  useEffect(() => {
    if (!roomId || Object.keys(memberRanks).length === 0) return
    updateDailyMvpMeta(roomId, memberRanks).catch(() => {})
  }, [roomId, memberRanks])

  useEffect(() => {
    if (!user) return
    const prev = prevMuteRef.current
    if (prev && !myMute) {
      setGuboPending({ byUserName: prev.byUserName, byRankName: prev.byRankName })
    }
    prevMuteRef.current = myMute
  }, [myMute, user])

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
      if (!cancelled) setMeta((m) => ({ ...m, birthdays: list }))
    })()
    return () => { cancelled = true }
  }, [roomMemberIds.join(','), memberProfiles])

  const getPoints = (uid: string) => memberRanks[uid]?.points ?? 0

  const handleReprimand = useCallback(async (targetId: string, targetName: string) => {
    if (!user || !roomId) return
    if (!canMute(getPoints(user.uid), getPoints(targetId))) {
      toast('계급이 더 높을 때만 훈계할 수 있어요')
      return
    }
    const actorRankName = getRankName(getPoints(user.uid))
    const line = randomReprimand()
    try {
      await setDoc(doc(db, 'rooms', roomId, 'mutes', targetId), {
        byUserId: user.uid,
        byUserName: user.displayName || '친구',
        byRankName: actorRankName,
        until: Date.now() + REPRIMAND_MS,
      })
      await postRankEvent(
        roomId,
        { uid: user.uid, name: user.displayName || '친구', photoURL: user.photoURL },
        'reprimand',
        `📢 ${user.displayName} ${actorRankName}: "${line}" → ${targetName}님 30초 벙어리!`,
      )
      toast('훈계! 📢')
    } catch {
      toast('훈계 실패…')
    }
  }, [user, roomId, memberRanks, toast])

  const handleRebellion = useCallback(async () => {
    if (!user || !roomId || !roomMemberIds.length) return
    const lowest = findLowestRankMembers(roomMemberIds, memberRanks)
    if (!lowest.includes(user.uid)) {
      toast('최하위 계급만 이병 반란을 쓸 수 있어요')
      return
    }
    const usedRef = doc(db, 'rooms', roomId, 'meta', `rebellion_${todayKey()}_${user.uid}`)
    const used = await getDoc(usedRef)
    if (used.exists()) {
      toast('오늘은 이미 반란을 썼어요')
      return
    }
    try {
      await Promise.all(
        roomMemberIds
          .filter((id) => id !== user.uid)
          .map((id) => setDoc(doc(db, 'rooms', roomId, 'mutes', id), {
            byUserId: user.uid,
            byUserName: user.displayName || '친구',
            byRankName: getRankName(getPoints(user.uid)),
            until: Date.now() + REBELLION_MS,
          })),
      )
      await postRankEvent(
        roomId,
        { uid: user.uid, name: user.displayName || '친구', photoURL: user.photoURL },
        'rebellion',
        `⚡ ${user.displayName} 이병 반란! 전원 3초 벙어리!`,
      )
      await setDoc(usedRef, { used: true })
      toast('이병 반란! ⚡')
    } catch {
      toast('반란 실패…')
    }
  }, [user, roomId, roomMemberIds, memberRanks, toast])

  const handleGubo = useCallback(async () => {
    if (!user || !roomId || !guboPending) return
    const name = user.displayName || '친구'
    const text = buildGuboText(name, guboPending.byUserName, guboPending.byRankName)
    try {
      for (let i = 0; i < 3; i++) {
        await addDoc(collection(db, 'rooms', roomId, 'messages'), {
          text,
          authorId: user.uid,
          authorName: name,
          authorPhotoURL: user.photoURL || '',
          createdAt: serverTimestamp(),
        })
      }
      await postRankEvent(roomId, { uid: user.uid, name, photoURL: user.photoURL }, 'gubo', `🫡 ${name} 구보 완료!`)
      setGuboPending(null)
      toast('구보 완료!')
    } catch {
      toast('구보 실패…')
    }
  }, [user, roomId, guboPending, memberRanks, toast])

  const setRoomTheme = useCallback(async (accent: string) => {
    if (!user || !roomId) return
    if (getRankLevel(getPoints(user.uid)) < 6) {
      toast('상사만 방 테마를 바꿀 수 있어요')
      return
    }
    await setDoc(doc(db, 'rooms', roomId, 'meta', 'roomTheme'), {
      accent,
      until: Date.now() + THEME_MS,
      byUserName: user.displayName || '친구',
    })
    toast('방 테마 변경! 🎨')
  }, [user, roomId, memberRanks, toast])

  const saveTitle = useCallback(async (title: string) => {
    if (!user || !roomId) return
    await setEquippedTitle(roomId, user.uid, user.displayName || '친구', title)
    toast('칭호 장착! 🎖️')
  }, [user, roomId, toast])

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

  const themeAccent = meta.roomTheme && meta.roomTheme.until > Date.now()
    ? meta.roomTheme.accent
    : undefined

  return {
    meta,
    guboPending,
    setGuboPending,
    loginStreak,
    themeAccent,
    handleReprimand,
    handleRebellion,
    handleGubo,
    setRoomTheme,
    saveTitle,
    saveBirthday,
    createPoll,
    votePoll,
    scheduleMessage,
    ROOM_THEMES,
  }
}
