import { Link, useNavigate } from 'react-router'
import { useUser } from '../context/UserContext'

const BREAK_THRESHOLD = 100

export default function NavBar() {
  const { user, logout } = useUser()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Don't render on auth pages
  if (!user) return null

  const xpPct = user.xp_total % BREAK_THRESHOLD

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">⚔️ QuestLog</Link>

      <div className="xp-bar-mini">
        <span className="xp-mini-label">{user.xp_total} XP</span>
        <div className="xp-bar-track-mini">
          <div className="xp-bar-fill-mini" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <div className="nav-links">
        <Link to="/">Dashboard</Link>
        <Link to="/profile">{user.name}</Link>
        <button onClick={handleLogout} className="nav-logout">Log out</button>
      </div>
    </nav>
  )
}