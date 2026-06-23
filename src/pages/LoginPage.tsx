import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyPending, setVerifyPending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError('이름을 입력해주세요.')
          setLoading(false)
          return
        }
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(user, { displayName: name.trim() })
        await sendEmailVerification(user)
        await signOut(auth)
        setVerifyPending(true)
      } else {
        const { user } = await signInWithEmailAndPassword(auth, email, password)
        if (!user.emailVerified) {
          await signOut(auth)
          setError('이메일 인증이 필요해요. 받은 편지함을 확인해주세요.')
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') setError('이미 사용 중인 이메일이에요.')
      else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        setError('이메일 또는 비밀번호가 틀렸어요.')
      else if (code === 'auth/weak-password') setError('비밀번호는 6자 이상이어야 해요.')
      else if (code === 'auth/invalid-email') setError('이메일 형식이 올바르지 않아요.')
      else setError('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    setError('')
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      await sendEmailVerification(user)
      await signOut(auth)
      setResent(true)
      setTimeout(() => setResent(false), 3000)
    } catch {
      setError('재전송 실패. 잠시 후 다시 시도해주세요.')
    }
  }

  if (verifyPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-pink-50 to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">📧</div>
            <h1 className="text-3xl font-black text-violet-700 tracking-tight">우리방</h1>
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">이메일을 확인해주세요!</h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-violet-600">{email}</span>로
            </p>
            <p className="text-sm text-gray-500 mb-6">
              인증 링크를 보냈어요. 링크를 클릭한 후 로그인해주세요.
            </p>
            <button
              onClick={() => { setVerifyPending(false); setIsSignUp(false) }}
              className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-3 rounded-xl transition-colors mb-3"
            >
              로그인하러 가기
            </button>
            <button
              onClick={resendVerification}
              className="text-sm text-violet-500 hover:text-violet-700 font-medium"
            >
              {resent ? '✓ 재전송 완료!' : '인증 메일 다시 보내기'}
            </button>
            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-pink-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-6xl mb-3">🏠</div>
          <h1 className="text-3xl font-black text-violet-700 tracking-tight">우리방</h1>
          <p className="text-gray-500 mt-1 text-sm">친한 친구들과 함께하는 우리만의 공간</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            {isSignUp ? '회원가입' : '로그인'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="친구들에게 보여질 이름"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-300"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-300"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6자 이상"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-300"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-500 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-500 hover:bg-violet-600 disabled:bg-violet-300 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? '처리 중...' : isSignUp ? '가입하기' : '시작하기'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              className="text-sm text-violet-500 hover:text-violet-700 font-medium"
            >
              {isSignUp
                ? '이미 계정이 있어요 → 로그인'
                : '아직 계정이 없어요 → 회원가입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
