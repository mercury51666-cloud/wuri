import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true

  useEffect(() => {
    if (isInStandaloneMode) return
    if (localStorage.getItem('wuri_install_dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  useEffect(() => {
    if (isInStandaloneMode || !isIOS) return
    if (localStorage.getItem('wuri_install_dismissed')) return
    const timer = setTimeout(() => setShowIOSGuide(true), 3000)
    return () => clearTimeout(timer)
  }, [isIOS, isInStandaloneMode])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('wuri_install_dismissed', '1')
    setDismissed(true)
    setDeferredPrompt(null)
    setShowIOSGuide(false)
  }

  if (dismissed || isInStandaloneMode) return null

  // Android / Chrome: 설치 프롬프트 배너
  if (deferredPrompt) {
    return (
      <div className="mx-4 mb-4 bg-violet-500 dark:bg-violet-600 rounded-2xl p-4 flex items-center gap-3 shadow-lg shadow-violet-200 dark:shadow-none">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">앱으로 설치하기</p>
          <p className="text-violet-200 text-xs mt-0.5">홈 화면에 추가하면 앱처럼 사용할 수 있어요</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={handleInstall} className="bg-white text-violet-600 font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform">
            설치
          </button>
          <button onClick={handleDismiss} className="text-violet-300 text-lg leading-none px-1">✕</button>
        </div>
      </div>
    )
  }

  // iOS Safari: 수동 안내 배너
  if (showIOSGuide) {
    return (
      <div className="mx-4 mb-4 bg-white dark:bg-white/5 border border-violet-100 dark:border-white/10 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="font-bold text-gray-800 dark:text-white text-sm">📲 홈 화면에 추가하기</p>
          <button onClick={handleDismiss} className="text-gray-400 text-lg leading-none">✕</button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="w-5 h-5 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">1</span>
            <span>하단의 <span className="font-semibold">공유 버튼(□↑)</span> 탭</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="w-5 h-5 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">2</span>
            <span><span className="font-semibold">"홈 화면에 추가"</span> 선택</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="w-5 h-5 bg-violet-100 dark:bg-violet-500/20 rounded-full flex items-center justify-center text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">3</span>
            <span>오른쪽 상단 <span className="font-semibold">"추가"</span> 탭</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
