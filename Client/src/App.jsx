import { Routes, Route, Navigate } from 'react-router'
import { useUser } from './context/UserContext'
import NavBar from './components/NavBar'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dash'
import ProjectDetail from './pages/ProjDetail'
import Profile from './pages/Profile'

// Redirects to /login if not authenticated
function ProtectedRoute({ children }) {
  const { user, loading } = useUser()
  if (loading) return <div className="loading">Loading...</div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="main-content">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes — redirect to /login if no session */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}