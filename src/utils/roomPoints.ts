import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '../firebase'
import {
  getRankFromPoints,
  getWeekKey,
  getPreviousWeekKey,
  POINTS,
} from './rankSystem'
import { postRankEvent } from './rankEvents'

export interface RoomRankData {
  userId: string
  userName: string
  points: number
  rankName: string
  rankEmoji: string
  weeklyMissions: number
  weeklyMessages: number
  weekKey: string
  todayMessageCount: number
  todayDate: string
  missionBonusDates: string[]
  equippedTitle?: string
  loginStreak?: number
  lastLoginDate?: string
}

export interface HallEntry {
  weekKey: string
  type: 'mission' | 'chat' | 'overall'
  userName: string
  userId: string
  value: number
}

async function maybePostPromotion(
  roomId: string,
  userId: string,
  userName: string,
  prevRankName: string,
  newRankName: string,
) {
  if (prevRankName === newRankName) return
  await postRankEvent(
    roomId,
    { uid: userId, name: userName },
    'promotion',
    `🎉 ${userName} ${prevRankName} → ${newRankName} 임관! 축하합니다!`,
  )
}

async function processWeeklyBonus(roomId: string, currentWeek: string) {
  const prevWeek = getPreviousWeekKey(currentWeek)
  if (!prevWeek) return

  const processedRef = doc(db, 'rooms', roomId, 'meta', `weeklyBonus_${currentWeek}`)
  const processedSnap = await getDoc(processedRef)
  if (processedSnap.exists()) return

  const ranksSnap = await getDocs(collection(db, 'rooms', roomId, 'ranks'))
  const prevRanks = ranksSnap.docs
    .map((d) => d.data() as RoomRankData)
    .filter((r) => r.weekKey === prevWeek)

  if (prevRanks.length > 0) {
    const topMission = [...prevRanks].sort((a, b) => b.weeklyMissions - a.weeklyMissions)[0]
    const topChat = [...prevRanks].sort((a, b) => b.weeklyMessages - a.weeklyMessages)[0]
    const bonuses: Record<string, number> = {}

    if (topMission?.weeklyMissions > 0) {
      bonuses[topMission.userId] = (bonuses[topMission.userId] ?? 0) + POINTS.WEEKLY_MISSION_TOP
    }
    if (topChat?.weeklyMessages > 0) {
      bonuses[topChat.userId] = (bonuses[topChat.userId] ?? 0) + POINTS.WEEKLY_CHAT_TOP
    }

    for (const [userId, bonus] of Object.entries(bonuses)) {
      const ref = doc(db, 'rooms', roomId, 'ranks', userId)
      const snap = await getDoc(ref)
      if (!snap.exists()) continue
      const data = snap.data() as RoomRankData
      const points = data.points + bonus
      const rank = getRankFromPoints(points)
      await setDoc(ref, {
        points,
        rankName: rank.name,
        rankEmoji: rank.emoji,
        weekKey: currentWeek,
        weeklyMissions: 0,
        weeklyMessages: 0,
      }, { merge: true })
    }

    const hallRef = doc(db, 'rooms', roomId, 'meta', 'hallOfFame')
    const hallSnap = await getDoc(hallRef)
    const entries: HallEntry[] = hallSnap.exists() ? (hallSnap.data().entries ?? []) : []
    if (topMission?.weeklyMissions) {
      entries.unshift({ weekKey: prevWeek, type: 'mission', userName: topMission.userName, userId: topMission.userId, value: topMission.weeklyMissions })
    }
    if (topChat?.weeklyMessages) {
      entries.unshift({ weekKey: prevWeek, type: 'chat', userName: topChat.userName, userId: topChat.userId, value: topChat.weeklyMessages })
    }
    const topOverall = [...prevRanks].sort((a, b) => b.points - a.points)[0]
    if (topOverall) {
      await setDoc(doc(db, 'rooms', roomId, 'meta', `weeklyChampion_${currentWeek}`), {
        userId: topOverall.userId,
        userName: topOverall.userName,
        title: '🏆 계급전 우승',
        weekKey: prevWeek,
      }, { merge: true })
      entries.unshift({ weekKey: prevWeek, type: 'overall', userName: topOverall.userName, userId: topOverall.userId, value: topOverall.points })
    }
    await setDoc(hallRef, { entries: entries.slice(0, 30) }, { merge: true })
  }

  await setDoc(processedRef, { processed: true, forWeek: prevWeek })
}

async function loadRank(roomId: string, userId: string, userName: string): Promise<RoomRankData> {
  const ref = doc(db, 'rooms', roomId, 'ranks', userId)
  const snap = await getDoc(ref)
  const weekKey = getWeekKey()
  const today = new Date().toISOString().slice(0, 10)

  if (!snap.exists()) {
    const rank = getRankFromPoints(0)
    return {
      userId,
      userName,
      points: 0,
      rankName: rank.name,
      rankEmoji: rank.emoji,
      weeklyMissions: 0,
      weeklyMessages: 0,
      weekKey,
      todayMessageCount: 0,
      todayDate: today,
      missionBonusDates: [],
      loginStreak: 0,
      lastLoginDate: '',
    }
  }

  const data = snap.data() as RoomRankData
  if (data.weekKey !== weekKey) {
    return {
      ...data,
      userName,
      weekKey,
      weeklyMissions: 0,
      weeklyMessages: 0,
      todayMessageCount: data.todayDate === today ? data.todayMessageCount : 0,
      todayDate: today,
    }
  }
  if (data.todayDate !== today) {
    return { ...data, userName, todayMessageCount: 0, todayDate: today }
  }
  return { ...data, userName }
}

async function saveRank(roomId: string, data: RoomRankData) {
  await setDoc(doc(db, 'rooms', roomId, 'ranks', data.userId), data, { merge: true })
}

export async function recordLoginStreak(
  roomId: string,
  userId: string,
  userName: string,
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const data = await loadRank(roomId, userId, userName)
  if (data.lastLoginDate === today) return data.loginStreak ?? 0

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const streak = data.lastLoginDate === yesterday ? (data.loginStreak ?? 0) + 1 : 1
  data.loginStreak = streak
  data.lastLoginDate = today
  if (streak >= 2) data.points += Math.min(streak, 7)
  const rank = getRankFromPoints(data.points)
  data.rankName = rank.name
  data.rankEmoji = rank.emoji
  await saveRank(roomId, data)
  return streak
}

export async function setEquippedTitle(roomId: string, userId: string, userName: string, title: string) {
  const data = await loadRank(roomId, userId, userName)
  data.equippedTitle = title.slice(0, 12)
  await saveRank(roomId, data)
}

export async function awardMissionPoints(
  roomId: string,
  userId: string,
  userName: string,
  today: string,
  completedAllToday: boolean,
): Promise<{ gained: number; label: string }> {
  await processWeeklyBonus(roomId, getWeekKey())
  const data = await loadRank(roomId, userId, userName)
  const prevRankName = data.rankName

  let gained = POINTS.MISSION
  data.weeklyMissions += 1
  data.points += POINTS.MISSION

  if (completedAllToday && !data.missionBonusDates.includes(today)) {
    gained += POINTS.MISSION_DAILY_BONUS
    data.points += POINTS.MISSION_DAILY_BONUS
    data.missionBonusDates = [...data.missionBonusDates.slice(-13), today]
  }

  const rank = getRankFromPoints(data.points)
  data.rankName = rank.name
  data.rankEmoji = rank.emoji
  await saveRank(roomId, data)
  await maybePostPromotion(roomId, userId, userName, prevRankName, rank.name)

  return { gained, label: `${rank.name}` }
}

export async function awardMessagePoints(
  roomId: string,
  userId: string,
  userName: string,
): Promise<number> {
  await processWeeklyBonus(roomId, getWeekKey())
  const data = await loadRank(roomId, userId, userName)
  const prevRankName = data.rankName

  if (data.todayMessageCount >= POINTS.MESSAGE_DAILY_CAP) return 0

  data.todayMessageCount += 1
  data.weeklyMessages += 1
  data.points += POINTS.MESSAGE

  const rank = getRankFromPoints(data.points)
  data.rankName = rank.name
  data.rankEmoji = rank.emoji
  await saveRank(roomId, data)
  await maybePostPromotion(roomId, userId, userName, prevRankName, rank.name)

  return POINTS.MESSAGE
}
