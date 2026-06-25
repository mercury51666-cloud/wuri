import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  getRankFromPoints,
  getWeekKey,
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

export async function awardMissionPoints(
  roomId: string,
  userId: string,
  userName: string,
  today: string,
  completedAllToday: boolean,
): Promise<{ gained: number; label: string }> {
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
