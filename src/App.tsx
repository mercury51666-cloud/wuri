import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthState } from './hooks/useAuthState'
import { ThemeProvider } from './contexts/ThemeContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import RoomPage from './pages/RoomPage'

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
          element={user?.emailVerified ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={user?.emailVerified ? <HomePage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/room/:roomId"
          element={user?.emailVerified ? <RoomPage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
