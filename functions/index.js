const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getMessaging } = require('firebase-admin/messaging')
const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')

initializeApp()
setGlobalOptions({ region: 'asia-northeast3' })

const APP_URL = process.env.APP_URL || 'https://wuri-iota.vercel.app'

function shouldNotify(msg) {
  if (msg.messageType === 'rank_event' || msg.type === 'rank_event') return false
  return true
}

function messageBody(msg) {
  if (msg.text?.trim()) return msg.text.trim().slice(0, 120)
  if (msg.imageURL) return '📷 사진'
  if (msg.messageType === 'poll') return `📊 ${msg.pollQuestion || msg.text || '투표'}`
  return '새 메시지'
}

exports.notifyNewMessage = onDocumentCreated('rooms/{roomId}/messages/{messageId}', async (event) => {
  const snap = event.data
  if (!snap) return

  const msg = snap.data()
  if (!shouldNotify(msg) || !msg.authorId) return

  const roomId = event.params.roomId
  const db = getFirestore()
  const roomSnap = await db.doc(`rooms/${roomId}`).get()
  const room = roomSnap.data()
  if (!room?.memberIds?.length) return

  const recipients = room.memberIds.filter((id) => id !== msg.authorId)
  if (recipients.length === 0) return

  const tokens = []
  for (const uid of recipients) {
    const tokenSnap = await db.collection(`users/${uid}/fcmTokens`).get()
    tokenSnap.forEach((doc) => {
      const token = doc.data().token
      if (token) tokens.push(token)
    })
  }
  if (tokens.length === 0) return

  const roomName = room.name || '우리방'
  const authorName = msg.authorName || '친구'
  const link = `${APP_URL}/room/${roomId}`

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: `${roomName} — ${authorName}`,
      body: messageBody(msg),
    },
    data: {
      roomId,
      url: link,
    },
    webpush: {
      fcmOptions: { link },
    },
  })

  // Remove invalid/expired tokens
  const batch = db.batch()
  for (let i = 0; i < response.responses.length; i++) {
    const res = response.responses[i]
    if (res.success) continue
    if (res.error?.code !== 'messaging/registration-token-not-registered') continue
    const token = tokens[i]
    for (const uid of recipients) {
      const tokenSnap = await db.collection(`users/${uid}/fcmTokens`).where('token', '==', token).get()
      tokenSnap.forEach((d) => batch.delete(d.ref))
    }
  }
  await batch.commit().catch(() => {})
})
