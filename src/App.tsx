import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useAuthState } from './hooks/useAuthState'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { consumeInvitePath, isAuthRedirectPending, saveInvitePath } from './utils/inviteStorage'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import RoomPage from './pages/RoomPage'

function RequireAuth({ user, children }: { user: User | null; children: ReactNode }) {
  const location = useLocation()
  if (!user) {
    if (location.pathname.startsWith('/room/')) {
      saveInvitePath(location.pathname)
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

function LoginRoute({
  user,
  authError,
  onClearAuthError,
}: {
  user: User | null
  authError: string | null
  onClearAuthError: () => void
}) {
  const location = useLocation()
  if (user) {
    const fromState = (location.state as { from?: string })?.from
    const from = consumeInvitePath(fromState ?? '/')
    return <Navigate to={from} replace />
  }
  return (
    <LoginPage
      authError={authError}
      onClearAuthError={onClearAuthError}
      completingRedirect={isAuthRedirectPending()}
    />
  )
}

function App() {
  const { user, loading, authError, clearAuthError } = useAuthState()

  if (loading) {
    return (
      <div className="app-shell flex flex-1 min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="w-11 h-11 border-[3px] border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)] font-medium text-sm">
            {isAuthRedirectPending() ? '로그인 마무리 중...' : '잠깐만요...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <div className="flex flex-col flex-1 min-h-dvh">
      <Routes>
        <Route
          path="/login"
          element={
            <LoginRoute
              user={user}
              authError={authError}
              onClearAuthError={clearAuthError}
            />
          }
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
      </div>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  )
}

export default App
