import { createRoot } from 'react-dom/client'
import { authRedirectPromise } from './authBootstrap'
import { auth } from './firebase'
import App from './App'
import './index.css'

async function boot() {
  await authRedirectPromise

  // redirect 직후 currentUser가 먼저 채워지는 경우 대비
  if (auth.currentUser) {
    await auth.currentUser.reload().catch(() => {})
  }

  createRoot(document.getElementById('root')!).render(<App />)
}

boot()
