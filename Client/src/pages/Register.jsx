
import { useState } from 'react'
import { useNavigate, Link } from 'react-router'
import { useUser } from '../context/UserContext'

export default function Register() {
  const { register } = useUser()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    register(form.name, form.email, form.password)
      .then(() => navigate('/'))
      .catch(err => setError(err))
      .finally(() => setLoading(false))
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>⚔️ QuestLog</h1>
        <h2>Create account</h2>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input name="name" type="text" placeholder="Username" value={form.name} onChange={handleChange} required />
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input name="password" type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={handleChange} required minLength={8} />
          <button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
        </form>
        <p>Already registered? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  )
}