import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useAuthState } from './hooks/useAuthState'
import { ThemeProvider } from './contexts/ThemeContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import RoomPage from './pages/RoomPage'

function RequireAuth({ user, children }: { user: User | null; children: ReactNode }) {
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

// 로그인 후 원래 가려던 경로로 이동
function LoginRoute({ user }: { user: User | null }) {
  const location = useLocation()
  if (user) {
    const from = (location.state as { from?: string })?.from ?? '/'
    return <Navigate to={from} replace />
  }
  return <LoginPage />
}

function App() {
  const { user, loading } = useAuthState()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-violet-500 font-medium">잠깐만요...</p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={<LoginRoute user={user} />}
        />
        <Route
          path="/"
          element={<RequireAuth user={user}><HomePage /></RequireAuth>}
        />
        <Route
          path="/room/:roomId"
          element={<RequireAuth user={user}><RoomPage /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
