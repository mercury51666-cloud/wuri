import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './authBootstrap'
import App from './App'

// 서비스워커가 새 버전으로 교체되는 순간(=배포 반영) 자동으로 새로고침한다.
// 이게 없으면 새 배포를 해도 캐시된 이전 SW/번들이 계속 실행돼서, 앱을 완전히
// 껐다가 두 번 정도 다시 열어야만 최신 코드가 반영되는 문제가 있었다.
if ('serviceWorker' in navigator) {
  let reloadedForNewSw = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewSw) return
    reloadedForNewSw = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
