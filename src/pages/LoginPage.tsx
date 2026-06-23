import { useState, useEffect } from 'react'
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult } from 'firebase/auth'
import { auth } from '../firebase'

export default function LoginPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getRedirectResult(auth)
      .then(() => setLoading(false))
      .catch(() => {
        setError('구글 로그인에 실패했어요. 다시 시도해주세요.')
        setLoading(false)
      })
  }, [])

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    await signInWithRedirect(auth, new GoogleAuthProvider())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-pink-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">🏠</div>
          <h1 className="text-3xl font-black text-violet-700 tracking-tight">우리방</h1>
          <p className="text-gray-500 mt-2 text-sm">친한 친구들과 함께하는 우리만의 공간</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-2 text-center">시작하기</h2>
          <p className="text-sm text-gray-400 text-center mb-6">구글 계정으로 간편하게 로그인해요</p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-gray-700 font-bold py-4 rounded-2xl transition-all shadow-sm disabled:opacity-50"
          >
            <svg width="22" height="22" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {loading ? '로그인 중...' : 'Google로 시작하기'}
          </button>

          {error && (
            <div className="mt-4 bg-red-50 text-red-500 text-sm px-4 py-3 rounded-xl text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
