import { useState } from 'react'
import { useUser } from '../context/UserContext'
 
const BREAK_THRESHOLD = 100
 
export default function Profile() {
  const { user, setUser, authFetch } = useUser()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: user.name })
  const [error, setError] = useState('')
 
  const xpIntoLevel  = user.xp_total % BREAK_THRESHOLD
  const breaksEarned = Math.floor(user.xp_total / BREAK_THRESHOLD)
 
  // UPDATE user name
  function handleSave(e) {
    e.preventDefault()
    authFetch(`/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: form.name }),
    })
      .then(async r => {
        const data = await r.json().catch(() => null)
        if (!r.ok) {
          const message = typeof data?.error === 'string'
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : 'Update failed'
          throw new Error(message)
        }
        return data
      })
      .then(updated => { setUser(updated); setEditing(false) })
      .catch(err => setError(err?.message || String(err)))
  }
 
  return (
    <div className="page">
      <h1>Profile</h1>
 
      <div className="profile-card">
        <div className="avatar-circle">{user.name.charAt(0).toUpperCase()}</div>
 
        {editing ? (
          <form onSubmit={handleSave} className="inline-form">
            {error && <p className="error">{error}</p>}
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            <div className="btn-row">
              <button type="submit">Save</button>
              <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <h2>{user.name}</h2>
            <p className="muted">{user.email}</p>
            {user.is_admin && <span className="admin-badge">Admin</span>}
            <button onClick={() => setEditing(true)} className="btn-secondary">Edit name</button>
          </>
        )}
      </div>
 
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Total XP</p>
          <p className="stat-value">{user.xp_total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Breaks earned</p>
          <p className="stat-value">{breaksEarned}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">XP to next break</p>
          <p className="stat-value">{BREAK_THRESHOLD - xpIntoLevel}</p>
        </div>
      </div>
 
      <div className="xp-progress">
        <p className="stat-label">Progress to next break</p>
        <div className="xp-bar-track">
          <div className="xp-bar-fill" style={{ width: `${xpIntoLevel}%` }} />
        </div>
        <span className="xp-label">{xpIntoLevel} / {BREAK_THRESHOLD} XP</span>
      </div>
    </div>
  )
}
 