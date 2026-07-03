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

  if (deferredPrompt) {
    return (
      <div className="card p-4 flex items-center gap-3 bg-[var(--brand)] border-none shadow-[var(--shadow-card)]">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">📲</div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">앱으로 설치하기</p>
          <p className="text-white/80 text-xs mt-0.5">홈 화면에 추가하면 더 편해요</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={handleInstall} className="bg-white text-[var(--brand)] font-bold text-xs px-3 py-2 rounded-xl active:scale-95 transition-transform">
            설치
          </button>
          <button type="button" onClick={handleDismiss} className="text-white/70 text-lg leading-none px-1" aria-label="닫기">✕</button>
        </div>
      </div>
    )
  }

  if (showIOSGuide) {
    return (
      <div className="card p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="font-bold text-[var(--text)] text-sm">📲 홈 화면에 추가하기</p>
          <button type="button" onClick={handleDismiss} className="text-[var(--text-muted)] text-lg leading-none" aria-label="닫기">✕</button>
        </div>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>1. 하단 <span className="font-semibold text-[var(--text)]">공유(□↑)</span> 탭</p>
          <p>2. <span className="font-semibold text-[var(--text)]">홈 화면에 추가</span> 선택</p>
          <p>3. <span className="font-semibold text-[var(--text)]">추가</span> 탭</p>
        </div>
      </div>
    )
  }

  return null
}
