import { useState, useEffect } from 'react'
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { auth } from '../firebase'
import { markAuthRedirectPending } from '../utils/inviteStorage'
import { Link2 } from 'lucide-react'

function isInAppBrowser() {
  const ua = navigator.userAgent
  return /FBAN|FBAV|Instagram|Messenger|Line|KAKAOTALK|Snapchat|TikTok|WhatsApp|Twitter|NaverApp|DaumApp/i.test(ua)
}

function shouldUseRedirect() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

interface Props {
  authError?: string | null
  onClearAuthError?: () => void
  completingRedirect?: boolean
}

export default function LoginPage({ authError, onClearAuthError, completingRedirect }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const inApp = isInAppBrowser()

  useEffect(() => {
    if (authError) setError(authError)
  }, [authError])

  const handleGoogle = async () => {
    onClearAuthError?.()
    setError('')
    setLoading(true)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      if (shouldUseRedirect()) {
        markAuthRedirectPending()
        await signInWithRedirect(auth, provider)
        return
      }
      await signInWithPopup(auth, provider)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/popup-blocked' || shouldUseRedirect()) {
        try {
          markAuthRedirectPending()
          await signInWithRedirect(auth, provider)
          return
        } catch {
          setError('로그인 창을 열 수 없어요. Safari/Chrome에서 다시 시도해주세요.')
        }
      } else if (code !== 'auth/popup-closed-by-user') {
        setError('로그인에 실패했어요. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  const showLoading = loading || completingRedirect

  return (
    <div className="page-enter app-shell safe-top min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-6xl font-black tracking-tighter text-[var(--text)]">
            WU<span className="text-[var(--brand)]">RI</span>
          </h1>
          <p className="text-[var(--text-secondary)] mt-3 text-sm">친구들과 함께하는 공간</p>
        </div>

        <div className="card w-full p-8">
          {inApp ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 bg-amber-500/10 rounded-[var(--radius-xl)] flex items-center justify-center text-2xl">⚠️</div>
              <div>
                <p className="font-bold text-[var(--text)] text-base mb-2">앱 내 브라우저에서는 로그인이 안 돼요</p>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Google 보안 정책으로 카카오, 인스타 등<br />앱 안에서는 로그인이 차단돼요.<br />
                  <span className="font-semibold text-[var(--brand)]">Safari</span>에서 링크를 열어주세요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href).then(() => {
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2500)
                  })
                }}
                className="btn btn-primary w-full"
              >
                <Link2 size={18} />
                {copied ? '링크 복사됨!' : '링크 복사하기'}
              </button>
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-[var(--text-secondary)] mb-6">
                {completingRedirect
                  ? 'Google 로그인 마무리 중이에요...'
                  : '구글 계정으로 간편하게 시작해요'}
              </p>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={showLoading}
                className="btn btn-secondary w-full py-4 bg-[var(--surface)]"
              >
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {showLoading ? '로그인 중...' : 'Google로 시작하기'}
              </button>
              {error && <p className="mt-4 text-[var(--danger)] text-sm text-center">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
