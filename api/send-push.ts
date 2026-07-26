import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

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

interface PushRequestBody {
  roomId?: string
  senderId?: string
  senderName?: string
  roomName?: string
  text?: string
  imageURL?: string
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  try {
    initAdmin()
  } catch (err) {
    console.error('[send-push] admin init failed', err)
    // 서비스 계정 미설정 상태에서도 채팅 자체는 계속 되도록 200으로 조용히 종료
    res.status(200).json({ sent: 0, skipped: 'not-configured' })
    return
  }

  const body: PushRequestBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  const { roomId, senderId, senderName, roomName, text, imageURL } = body

  if (!roomId || !senderId) {
    res.status(400).json({ error: 'missing roomId/senderId' })
    return
  }

  try {
    const db = getFirestore()
    const roomSnap = await db.collection('rooms').doc(roomId).get()
    if (!roomSnap.exists) {
      res.status(404).json({ error: 'room not found' })
      return
    }

    const memberIds: string[] = roomSnap.data()?.memberIds ?? []
    const recipientIds = memberIds.filter((id) => id !== senderId)
    if (recipientIds.length === 0) {
      res.status(200).json({ sent: 0 })
      return
    }

    const userSnaps = await db.getAll(...recipientIds.map((id) => db.collection('users').doc(id)))
    const tokenToUserRef = new Map<string, (typeof userSnaps)[number]['ref']>()
    userSnaps.forEach((snap) => {
      const list: string[] = snap.data()?.fcmTokens ?? []
      list.forEach((t) => tokenToUserRef.set(t, snap.ref))
    })

    const tokens = Array.from(tokenToUserRef.keys())
    if (tokens.length === 0) {
      res.status(200).json({ sent: 0 })
      return
    }

    const bodyText = imageURL ? '📷 사진을 보냈어요' : (text ?? '새 메시지').slice(0, 80)
    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: {
        title: `${roomName ?? 'WURI'} · ${senderName ?? '친구'}`,
        body: bodyText,
        url: `/room/${roomId}`,
      },
      webpush: {
        fcmOptions: { link: `/room/${roomId}` },
      },
    })

    const staleTokens: string[] = []
    result.responses.forEach((r, i) => {
      if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
        staleTokens.push(tokens[i])
      }
    })

    if (staleTokens.length > 0) {
      const refsToClean = new Set(staleTokens.map((t) => tokenToUserRef.get(t)).filter(Boolean))
      await Promise.all(
        Array.from(refsToClean).map(async (ref) => {
          const snap = await ref!.get()
          const remaining = ((snap.data()?.fcmTokens ?? []) as string[]).filter((t) => !staleTokens.includes(t))
          await ref!.update({ fcmTokens: remaining }).catch(() => {})
        }),
      )
    }

    res.status(200).json({ sent: result.successCount })
  } catch (err) {
    console.error('[send-push] failed', err)
    res.status(500).json({ error: 'failed to send push' })
  }
}
