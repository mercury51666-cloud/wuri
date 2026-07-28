import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

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

export default async function handler(req: any, res: any) {
  try {
    initAdmin()
    const db = getFirestore()
    void db
    const body = req.body ?? {}
    if (body.email) {
      const authUser = await getAuth().getUserByEmail(body.email)
      res.status(200).json({ pong: true, step: 'app+firestore+auth', uid: authUser.uid })
      return
    }
    res.status(200).json({ pong: true, step: 'app+firestore+auth', authLoaded: typeof getAuth })
  } catch (err) {
    res.status(500).json({ error: String((err as Error)?.message ?? err), stack: (err as Error)?.stack })
  }
}
