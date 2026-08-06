// Gemini API를 서버에서만 호출한다 — API 키를 클라이언트에 노출하지 않기 위해서다.
// firebase-admin/auth는 이 프로젝트의 Vercel 런타임에서 import만 해도 함수가
// 죽는 버그가 있어(디버깅으로 확인됨) 쓰지 않고, send-push.ts와 같은 방식으로
// firebase-admin/app + firestore만으로 "이 uid가 실제 유저인지"를 가볍게 확인한다.
import { cert, getApps, initializeApp } from 'firebase-admin/app'
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

interface ChatTurn {
  role: 'user' | 'model'
  text: string
}

interface AiChatRequestBody {
  uid?: string
  message?: string
  history?: ChatTurn[]
}

const SYSTEM_INSTRUCTION =
  '너는 WURI라는 친한 친구들끼리 쓰는 프라이빗 채팅 앱 안에 있는 개인용 AI 도우미야. ' +
  '사용자가 궁금한 걸 물어보면 친근하고 간결한 말투로 한국어로 답해줘. 너무 길게 늘어놓지 말고 핵심만 자연스럽게 설명해.'

const MAX_HISTORY_TURNS = 12

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(200).json({ error: 'AI 기능이 아직 설정되지 않았어요 (GEMINI_API_KEY 미설정)' })
    return
  }

  const body: AiChatRequestBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
  const { uid, message, history } = body
  const trimmedMessage = message?.trim()
  if (!uid || !trimmedMessage) {
    res.status(400).json({ error: 'missing uid/message' })
    return
  }

  try {
    initAdmin()
    const db = getFirestore()
    const userSnap = await db.collection('users').doc(uid).get()
    if (!userSnap.exists) {
      res.status(403).json({ error: 'unknown user' })
      return
    }
  } catch (err) {
    console.error('[ai-chat] admin check failed', err)
    res.status(500).json({ error: 'server not configured' })
    return
  }

  try {
    const recentHistory = (history ?? []).slice(-MAX_HISTORY_TURNS)
    const contents = [
      ...recentHistory.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      { role: 'user', parts: [{ text: trimmedMessage }] },
    ]

    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
        }),
      },
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '')
      console.error('[ai-chat] gemini error', geminiRes.status, errText)
      res.status(502).json({ error: `AI 응답에 실패했어요 (${geminiRes.status}) ${errText.slice(0, 300)}` })
      return
    }

    const data = await geminiRes.json()
    const reply: string =
      data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''

    if (!reply.trim()) {
      const blockReason = data?.promptFeedback?.blockReason
      res.status(200).json({ reply: blockReason ? '이 질문에는 답하기 어려워요 🙏' : '음... 답을 못 만들었어요. 다시 물어봐 줄래요?' })
      return
    }

    res.status(200).json({ reply })
  } catch (err) {
    console.error('[ai-chat] failed', err)
    res.status(500).json({ error: 'AI 요청 중 오류가 났어요' })
  }
}
