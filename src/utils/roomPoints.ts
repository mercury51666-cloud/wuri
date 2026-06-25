import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore'
import { db } from '../firebase'
import {
  getRankFromPoints,
  getWeekKey,
  getPreviousWeekKey,
  POINTS,
} from './rankSystem'

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
  await processWeeklyBonus(roomId, getWeekKey())
  const data = await loadRank(roomId, userId, userName)

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

  return { gained, label: formatRankLabel(rank) }
}

export async function awardMessagePoints(
  roomId: string,
  userId: string,
  userName: string,
): Promise<number> {
  await processWeeklyBonus(roomId, getWeekKey())
  const data = await loadRank(roomId, userId, userName)

  if (data.todayMessageCount >= POINTS.MESSAGE_DAILY_CAP) return 0

  data.todayMessageCount += 1
  data.weeklyMessages += 1
  data.points += POINTS.MESSAGE

  const rank = getRankFromPoints(data.points)
  data.rankName = rank.name
  data.rankEmoji = rank.emoji
  await saveRank(roomId, data)

  return POINTS.MESSAGE
}

function formatRankLabel(rank: ReturnType<typeof getRankFromPoints>) {
  return `${rank.emoji} ${rank.name}`
}
