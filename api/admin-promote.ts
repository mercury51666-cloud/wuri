import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

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
]

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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  if (body.secret !== ADMIN_SECRET) {
    res.status(403).json({ error: 'forbidden' })
    return
  }

  try {
    initAdmin()
  } catch (err) {
    res.status(500).json({ error: 'admin init failed: ' + String((err as Error)?.message ?? err) })
    return
  }

  const { action, roomId, uid, minPoints } = body as {
    action?: string
    roomId?: string
    uid?: string
    minPoints?: number
  }
  if (!roomId) {
    res.status(400).json({ error: 'missing roomId' })
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

    if (action === 'list') {
      const userSnaps = await db.getAll(...memberIds.map((id) => db.collection('users').doc(id)))
      const rankSnaps = await db.getAll(...memberIds.map((id) => roomRef.collection('ranks').doc(id)))
      const members = memberIds.map((id, i) => ({
        uid: id,
        displayName: userSnaps[i].data()?.displayName ?? '(없음)',
        points: rankSnaps[i].data()?.points ?? 0,
        rankName: rankSnaps[i].data()?.rankName ?? '이병',
      }))
      res.status(200).json({ ok: true, roomName: roomSnap.data()?.name, members })
      return
    }

    if (action === 'promote') {
      if (!uid) {
        res.status(400).json({ error: 'missing uid' })
        return
      }
      if (!memberIds.includes(uid)) {
        res.status(400).json({ error: 'user not a member of this room' })
        return
      }

      const userRef = db.collection('users').doc(uid)
      const userSnap = await userRef.get()
      const userName: string = userSnap.data()?.displayName || '친구'
      const userPhotoURL: string = userSnap.data()?.photoURL || ''

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
        userName,
        prevRankName,
        newRankName: newRank.name,
        points: targetPoints,
      })
      return
    }

    res.status(400).json({ error: 'unknown action' })
  } catch (err) {
    console.error('[admin-promote] failed', err)
    res.status(500).json({ error: String((err as Error)?.message ?? err) })
  }
}
