import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { roomId, senderName, text, imageURL, memberIds } = req.body as {
    roomId: string
    senderName: string
    text: string
    imageURL?: string
    memberIds: string[]
  }

  try {
    const db = getFirestore()
    const tokenSet = new Set<string>()

    await Promise.all(
      memberIds.map(async (uid) => {
        const snap = await db.doc(`users/${uid}`).get()
        const tokens: string[] = snap.data()?.fcmTokens ?? []
        tokens.forEach((t) => tokenSet.add(t))
      })
    )

    const tokens = [...tokenSet]
    if (!tokens.length) return res.status(200).json({ sent: 0 })

    const body = imageURL ? '📷 사진을 보냈어요' : text
    const appUrl = process.env.VITE_APP_URL ?? 'https://wuri-kohl.vercel.app'

    const result = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: `${senderName} · WURI`,
        body: body.length > 60 ? body.slice(0, 60) + '…' : body,
      },
      webpush: {
        notification: {
          icon: `${appUrl}/icons/icon-192.png`,
          badge: `${appUrl}/icons/icon-192.png`,
          tag: roomId,
          renotify: true,
        },
        fcmOptions: { link: `${appUrl}/room/${roomId}` },
      },
      data: { roomId },
    })

    res.status(200).json({ sent: result.successCount, failed: result.failureCount })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: String(e) })
  }
}
