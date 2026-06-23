import { useState } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../firebase'

function isInAppBrowser() {
  const ua = navigator.userAgent
  return /FBAN|FBAV|Instagram|Messenger|Line|KAKAOTALK|Snapchat|TikTok|WhatsApp|Twitter|NaverApp|DaumApp/i.test(ua)
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const inApp = isInAppBrowser()

  const handleGoogle = async () => {
    setError('')
    setLoading(true)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/popup-closed-by-user') setError('로그인에 실패했어요. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-enter safe-top min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-violet-50 via-pink-50 to-orange-50 dark:bg-[#0d0d0d] dark:bg-none">
      <div className="absolute w-72 h-72 rounded-full bg-violet-400 opacity-10 dark:opacity-20 blur-3xl top-1/4 left-1/2 -translate-x-1/2 pointer-events-none" />

      <div className="relative w-full max-w-sm flex flex-col items-center gap-10">
        {/* 로고 */}
        <div className="text-center">
          <h1 className="text-7xl font-black tracking-tighter text-violet-700 dark:text-white" style={{ letterSpacing: '-0.04em' }}>
            WU<span className="text-violet-400">RI</span>
          </h1>
          <p className="text-gray-400 mt-3 text-sm tracking-widest uppercase">친구들과 함께하는 공간</p>
        </div>

        {/* 카드 */}
        <div className="w-full bg-white dark:bg-white/5 border border-violet-100 dark:border-white/10 shadow-xl dark:shadow-none backdrop-blur-md rounded-3xl p-8">
          {inApp ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl">⚠️</div>
              <div>
                <p className="font-bold text-gray-800 dark:text-white text-base mb-1">앱 내 브라우저에서는 로그인이 안 돼요</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  Google 보안 정책으로 카카오, 인스타, 메신저 등<br/>앱 안에서는 로그인이 차단돼요.<br/>
                  <span className="font-semibold text-violet-500">Safari 또는 Chrome</span>으로 열어주세요.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2500)
                  })
                }}
                className="w-full bg-violet-500 hover:bg-violet-600 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all text-sm"
              >
                {copied ? '✅ 링크 복사됨!' : '🔗 링크 복사하기'}
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-600">복사 후 Safari/Chrome 주소창에 붙여넣기 하세요</p>
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-gray-400 mb-6">구글 계정으로 간편하게 로그인해요</p>
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 dark:bg-white dark:hover:bg-gray-100 text-gray-800 font-bold py-4 rounded-2xl transition-all shadow-sm disabled:opacity-50 border border-gray-200 dark:border-transparent active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {loading ? '로그인 중...' : 'Google로 시작하기'}
              </button>
              {error && <p className="mt-4 text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
