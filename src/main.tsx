import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// 오래된 서비스 워커 및 캐시 강제 초기화
if ('serviceWorker' in navigator) {
  const SW_VERSION = '2'
  const stored = localStorage.getItem('sw_version')
  if (stored !== SW_VERSION) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      Promise.all(regs.map((r) => r.unregister())).then(() => {
        if ('caches' in window) {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        }
        localStorage.setItem('sw_version', SW_VERSION)
        window.location.reload()
      })
    })
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
