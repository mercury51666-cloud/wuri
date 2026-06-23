import { useState, useEffect } from 'react'
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthState } from '../../hooks/useAuthState'

interface BalanceQ {
  id: string
  question: string
  optionA: string
  optionB: string
  votesA: string[]
  votesB: string[]
  authorName: string
  createdAt: { seconds: number } | null
}

interface Props {
  roomId: string
}

export default function BalanceGame({ roomId }: Props) {
  const { user } = useAuthState()
  const [questions, setQuestions] = useState<BalanceQ[]>([])
  const [showForm, setShowForm] = useState(false)
  const [question, setQuestion] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'rooms', roomId, 'balanceGames'),
      orderBy('createdAt', 'desc')
    )
    return onSnapshot(q, (snap) => {
      setQuestions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BalanceQ)))
    })
  }, [roomId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !question.trim() || !optionA.trim() || !optionB.trim()) return
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'rooms', roomId, 'balanceGames'), {
        question: question.trim(),
        optionA: optionA.trim(),
        optionB: optionB.trim(),
        votesA: [],
        votesB: [],
        authorName: user.displayName || '친구',
        authorId: user.uid,
        createdAt: serverTimestamp(),
      })
      setQuestion('')
      setOptionA('')
      setOptionB('')
      setShowForm(false)
    } finally {
      setSubmitting(false)
    }
  }

  const vote = async (qId: string, side: 'A' | 'B', q: BalanceQ) => {
    if (!user) return
    const alreadyVoted = q.votesA.includes(user.uid) || q.votesB.includes(user.uid)
    if (alreadyVoted) return

    const field = side === 'A' ? 'votesA' : 'votesB'
    await updateDoc(doc(db, 'rooms', roomId, 'balanceGames', qId), {
      [field]: arrayUnion(user.uid),
    })
  }

  return (
    <div className="p-4 space-y-4">
      {/* 질문 만들기 버튼 */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2"
        >
          <span className="text-xl">⚖️</span>
          <span>밸런스 게임 만들기</span>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="font-bold text-gray-800">새 밸런스 게임</h3>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="질문 (예: 둘 중 하나만 평생 먹어야 한다면?)"
            className="w-full px-4 py-3 rounded-xl bg-gray-100 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              placeholder="A 선택지 (예: 치킨)"
              className="px-4 py-3 rounded-xl bg-orange-50 border border-orange-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              required
            />
            <input
              type="text"
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              placeholder="B 선택지 (예: 피자)"
              className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              required
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold text-sm"
            >
              {submitting ? '만드는 중...' : '만들기!'}
            </button>
          </div>
        </form>
      )}

      {/* 질문 목록 */}
      {questions.length === 0 ? (
        <div className="text-center py-12 text-gray-300">
          <div className="text-4xl mb-2">⚖️</div>
          <p className="text-sm">아직 밸런스 게임이 없어요</p>
          <p className="text-xs mt-1">첫 번째 질문을 만들어보세요!</p>
        </div>
      ) : (
        questions.map((q) => {
          const myVote = user
            ? q.votesA.includes(user.uid)
              ? 'A'
              : q.votesB.includes(user.uid)
              ? 'B'
              : null
            : null
          const total = q.votesA.length + q.votesB.length
          const pctA = total > 0 ? Math.round((q.votesA.length / total) * 100) : 50
          const pctB = 100 - pctA

          return (
            <div key={q.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 질문 */}
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs text-gray-400 mb-1">{q.authorName}의 질문</p>
                <p className="font-bold text-gray-800 text-base">{q.question}</p>
              </div>

              {/* 선택지 */}
              <div className="grid grid-cols-2 gap-0">
                <button
                  onClick={() => vote(q.id, 'A', q)}
                  disabled={myVote !== null}
                  className={`relative py-5 flex flex-col items-center gap-1 transition-colors ${
                    myVote === 'A'
                      ? 'bg-orange-500 text-white'
                      : myVote === 'B'
                      ? 'bg-orange-100 text-orange-300'
                      : 'bg-orange-50 hover:bg-orange-100 text-orange-600'
                  }`}
                >
                  <span className="font-black text-lg">A</span>
                  <span className="text-sm font-medium px-2 text-center">{q.optionA}</span>
                  {myVote !== null && (
                    <span className="text-xs font-bold mt-1">{pctA}%</span>
                  )}
                  {myVote === 'A' && (
                    <span className="absolute top-2 right-2 text-xs">✓</span>
                  )}
                </button>

                <button
                  onClick={() => vote(q.id, 'B', q)}
                  disabled={myVote !== null}
                  className={`relative py-5 flex flex-col items-center gap-1 transition-colors ${
                    myVote === 'B'
                      ? 'bg-blue-500 text-white'
                      : myVote === 'A'
                      ? 'bg-blue-100 text-blue-300'
                      : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                  }`}
                >
                  <span className="font-black text-lg">B</span>
                  <span className="text-sm font-medium px-2 text-center">{q.optionB}</span>
                  {myVote !== null && (
                    <span className="text-xs font-bold mt-1">{pctB}%</span>
                  )}
                  {myVote === 'B' && (
                    <span className="absolute top-2 right-2 text-xs">✓</span>
                  )}
                </button>
              </div>

              {/* 결과 바 */}
              {myVote !== null && total > 0 && (
                <div className="flex h-2">
                  <div className="bg-orange-400 transition-all duration-500" style={{ width: `${pctA}%` }} />
                  <div className="bg-blue-400 transition-all duration-500" style={{ width: `${pctB}%` }} />
                </div>
              )}

              <div className="px-4 py-2 text-xs text-gray-400 text-right">
                {total}명 참여 {myVote === null && '· 탭해서 선택!'}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
