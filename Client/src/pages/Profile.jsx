import { useState } from 'react'
import { useUser, API } from '../context/UserContext'

const BREAK_THRESHOLD = 100

export default function Profile() {
  const { user, setUser } = useUser()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: user.name })
  const [error, setError] = useState('')

  const xpIntoLevel  = user.xp_total % BREAK_THRESHOLD
  const breaksEarned = Math.floor(user.xp_total / BREAK_THRESHOLD)

  // UPDATE user name
  function handleSave(e) {
    e.preventDefault()
    fetch(`${API}/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
}