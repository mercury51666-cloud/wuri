import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { auth } from '../firebase'

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifyPending, setVerifyPending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (isSignUp) {
      if (!name.trim()) { setError('이름을 입력해주세요.'); return }
      if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않아요.'); return }
      if (password.length < 6) { setError('비밀번호는 6자 이상이어야 해요.'); return }
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(user, { displayName: name.trim() })
        await sendEmailVerification(user)
        setVerifyPending(true)
        await signOut(auth)
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
        setError('아이디 또는 비밀번호가 틀렸어요.')
      else if (code === 'auth/weak-password') setError('비밀번호는 6자 이상이어야 해요.')
      else if (code === 'auth/invalid-email') setError('이메일 형식이 올바르지 않아요.')
      else setError('오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user') setError('구글 로그인에 실패했어요.')
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

  const switchMode = () => {
    setIsSignUp(!isSignUp)
    setError('')
    setPasswordConfirm('')
  }

  if (verifyPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-100 via-pink-50 to-orange-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-6xl mb-3">🏠</div>
            <h1 className="text-3xl font-black text-violet-700 tracking-tight">우리방</h1>
          </div>
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="text-4xl mb-4">✉️</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">이메일을 확인해주세요!</h2>
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-violet-600">{email}</span>로
            </p>
            <p className="text-sm text-gray-500 mb-6">인증 링크를 보냈어요. 링크를 클릭한 후 로그인해주세요.</p>
            <button
              onClick={() => { setVerifyPending(false); setIsSignUp(false) }}
              className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-3 rounded-xl transition-colors mb-3"
            >
              로그인하러 가기
            </button>
            <button onClick={resendVerification} className="text-sm text-violet-500 hover:text-violet-700 font-medium">
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
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏠</div>
          <h1 className="text-3xl font-black text-violet-700 tracking-tight">우리방</h1>
          <p className="text-gray-500 mt-1 text-sm">친한 친구들과 함께하는 우리만의 공간</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">
            {isSignUp ? '회원가입' : '로그인'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
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
              <label className="block text-sm font-medium text-gray-600 mb-1">아이디 (이메일)</label>
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

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">비밀번호 확인</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="비밀번호 다시 입력"
                  className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800 placeholder-gray-300 ${
                    passwordConfirm && password !== passwordConfirm
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200'
                  }`}
                  required
                />
                {passwordConfirm && password !== passwordConfirm && (
                  <p className="text-xs text-red-500 mt-1 ml-1">비밀번호가 일치하지 않아요</p>
                )}
              </div>
            )}

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

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">또는</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="mt-3 w-full flex items-center justify-center gap-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            구글로 계속하기
          </button>

          <div className="mt-5 text-center">
            <button onClick={switchMode} className="text-sm text-violet-500 hover:text-violet-700 font-medium">
              {isSignUp ? '이미 계정이 있어요 → 로그인' : '아직 계정이 없어요 → 회원가입'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
