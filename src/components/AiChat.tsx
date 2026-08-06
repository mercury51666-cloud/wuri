import { useEffect, useRef, useState } from 'react'
import {
  collection, deleteDoc, doc, addDoc, onSnapshot, orderBy, query, serverTimestamp, getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthState } from '../hooks/useAuthState'
import { useToast } from '../contexts/ToastContext'

interface AiMessage {
  id: string
  role: 'user' | 'model'
  text: string
  createdAt: { seconds: number } | null
}

const MAX_HISTORY_TURNS = 12

export default function AiChat() {
  const { user } = useAuthState()
  const { toast } = useToast()
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [text, setText] = useState('')
  const [asking, setAsking] = useState(false)
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'users', user.uid, 'aiMessages'), orderBy('createdAt', 'asc'))
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AiMessage)))
    })
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, asking])

  const ask = async () => {
    const question = text.trim()
    if (!question || !user || asking) return
    setText('')
    setAsking(true)
    const history = messages.slice(-MAX_HISTORY_TURNS).map((m) => ({ role: m.role, text: m.text }))
    try {
      await addDoc(collection(db, 'users', user.uid, 'aiMessages'), {
        role: 'user',
        text: question,
        createdAt: serverTimestamp(),
      })
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, message: question, history }),
      })
      const data = await res.json()
      if (data.error && !data.reply) {
        toast(typeof data.error === 'string' ? data.error : 'AI 응답을 받지 못했어요')
        return
      }
      await addDoc(collection(db, 'users', user.uid, 'aiMessages'), {
        role: 'model',
        text: data.reply as string,
        createdAt: serverTimestamp(),
      })
    } catch {
      toast('AI에게 물어보는 데 실패했어요. 잠시 후 다시 시도해주세요')
    } finally {
      setAsking(false)
    }
  }

  const clearHistory = async () => {
    if (!user || clearing) return
    setClearing(true)
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'aiMessages'))
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'users', user.uid, 'aiMessages', d.id))))
    } catch {
      toast('대화 지우기에 실패했어요')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <p className="text-xs text-[var(--text-secondary)]">✨ 나만 보는 개인 AI예요 · 방 사람들에게는 안 보여요</p>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            disabled={clearing}
            className="text-xs text-[var(--text-muted)] font-medium shrink-0 disabled:opacity-50"
          >
            대화 지우기
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center text-3xl">✨</div>
            <p className="font-semibold text-gray-500 dark:text-gray-400">뭐든 물어보세요</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">궁금한 거 생겼을 때 편하게 질문해봐요</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] text-sm px-3.5 py-2.5 rounded-2xl whitespace-pre-wrap break-words ${
                m.role === 'user'
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {asking && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface-2)] text-[var(--text-muted)] text-sm px-3.5 py-2.5 rounded-2xl">
              생각 중...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask() }}
        className="flex items-center gap-2 px-3 py-2 shrink-0 border-t border-[var(--border)]"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="AI에게 물어보기..."
          disabled={asking}
          className="input-field flex-1 py-2.5 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={asking || !text.trim()}
          className="w-10 h-10 rounded-xl bg-[var(--brand)] active:scale-90 disabled:opacity-30 flex items-center justify-center text-white shrink-0 transition-all"
        >
          {asking ? '⏳' : '→'}
        </button>
      </form>
    </div>
  )
}
