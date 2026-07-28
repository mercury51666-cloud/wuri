import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

// 딱 한 번 쓰고 지울 임시 관리자 엔드포인트라 비밀키를 코드에 직접 넣어둔다.
const ADMIN_SECRET = 'wuri-onetime-8f2c9a1e6b4d7f30'

function initAdmin() {
  if (getApps().length) return
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('missing Firebase Admin service account env vars')
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

const RANK_TIERS = [
  { min: 0, name: '이병', emoji: '▮' },
  { min: 50, name: '일병', emoji: '▮▮' },
  { min: 150, name: '상병', emoji: '▮▮▮' },
  { min: 350, name: '병장', emoji: '▮▮▮▮' },
  { min: 700, name: '하사', emoji: '◢' },
  { min: 1200, name: '중사', emoji: '◢◢' },
  { min: 2000, name: '상사', emoji: '◢◢◢' },
] as const

function getRankFromPoints(points: number) {
  let tier = RANK_TIERS[0]
  for (const t of RANK_TIERS) {
    if (points >= t.min) tier = t
  }
  return tier
}

function getWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export default async function handler(req: any, res: any) {
  try {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  if (body.secret !== ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  if (body.ping) {
    res.status(200).json({ pong: true })
    return
  }

  try {
    initAdmin()
  } catch (err) {
    console.error('[admin-promote] admin init failed', err)
    res.status(500).json({ error: 'admin init failed' })
    return
  }

  const { roomId, email, minPoints } = body as { roomId?: string; email?: string; minPoints?: number }
  if (!roomId || !email) {
    res.status(400).json({ error: 'missing roomId/email' })
    return
  }

  try {
    const db = getFirestore()
    const roomRef = db.collection('rooms').doc(roomId)
    const roomSnap = await roomRef.get()
    if (!roomSnap.exists) {
      res.status(404).json({ error: 'room not found' })
      return
    }
    const memberIds: string[] = roomSnap.data()?.memberIds ?? []

    const authUser = await getAuth().getUserByEmail(email)
    const uid = authUser.uid
    if (!memberIds.includes(uid)) {
      res.status(400).json({ error: 'user not a member of this room', uid, memberIds })
      return
    }

    const userRef = db.collection('users').doc(uid)
    const userSnap = await userRef.get()
    const userName: string = userSnap.data()?.displayName || authUser.displayName || '친구'
    const userPhotoURL: string = userSnap.data()?.photoURL || authUser.photoURL || ''

    const rankRef = roomRef.collection('ranks').doc(uid)
    const rankSnap = await rankRef.get()
    const existing = rankSnap.exists ? (rankSnap.data() as Record<string, unknown>) : null
    const currentPoints = (existing?.points as number) ?? 0
    const targetPoints = Math.max(currentPoints, minPoints ?? 700)
    const prevRankName = (existing?.rankName as string) ?? getRankFromPoints(currentPoints).name
    const newRank = getRankFromPoints(targetPoints)
    const today = new Date().toISOString().slice(0, 10)

    await rankRef.set(
      {
        userId: uid,
        userName,
        points: targetPoints,
        rankName: newRank.name,
        rankEmoji: newRank.emoji,
        weeklyMissions: (existing?.weeklyMissions as number) ?? 0,
        weeklyMessages: (existing?.weeklyMessages as number) ?? 0,
        weekKey: (existing?.weekKey as string) ?? getWeekKey(),
        todayMessageCount: (existing?.todayMessageCount as number) ?? 0,
        todayDate: (existing?.todayDate as string) ?? today,
        missionBonusDates: (existing?.missionBonusDates as string[]) ?? [],
      },
      { merge: true },
    )

    if (prevRankName !== newRank.name) {
      await roomRef.collection('messages').add({
        messageType: 'rank_event',
        event: 'promotion',
        text: `🎉 ${userName} ${prevRankName} → ${newRank.name} 임관! 축하합니다!`,
        authorId: uid,
        authorName: userName,
        authorPhotoURL: userPhotoURL,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    res.status(200).json({
      ok: true,
      uid,
      roomName: roomSnap.data()?.name,
      prevRankName,
      newRankName: newRank.name,
      points: targetPoints,
    })
  } catch (err) {
    console.error('[admin-promote] failed', err)
    res.status(500).json({ error: String((err as Error)?.message ?? err) })
  }
  } catch (outerErr) {
    console.error('[admin-promote] outer failed', outerErr)
    try {
      res.status(500).json({ error: 'outer: ' + String((outerErr as Error)?.message ?? outerErr) })
    } catch {
      res.end('outer crash')
    }
  }
}
