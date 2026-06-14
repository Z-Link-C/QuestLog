import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '../context/UserContext'

export default function Login() {
  const { login } = useUser()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    login(form.email, form.password)
      .then(() => navigate('/'))
      .catch(err => setError(err?.message || String(err)))
      .finally(() => setLoading(false))
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>⚔️ QuestLog</h1>
        <h2>Log in</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input name="email"    type="email"    placeholder="Email"    value={form.email}    onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
        </form>
        <p>No account? <Link to="/register">Register</Link></p>
      </div>
    </div>
  )
}