import { useState, useEffect } from 'react'
import { useUser } from '../context/UserContext'
 
function formatTime(secs) {
  if (secs === null || secs === undefined) return null
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
 
export default function TaskCard({ task, isOwner, onDelete, onComplete, onUpdate }) {
  const { authFetch } = useUser()
  const [editing, setEditing]         = useState(false)
  const [form, setForm]               = useState({ name: task.name, description: task.description || '', est_minutes: task.est_minutes })
  const [secondsLeft, setSecondsLeft] = useState(task.seconds_remaining)
 
  // Live countdown — ticks every second while task is timed and incomplete
  useEffect(() => {
    if (!task.is_timed || task.completed || !task.seconds_remaining) return
    const interval = setInterval(() => setSecondsLeft(s => s > 0 ? s - 1 : 0), 1000)
    return () => clearInterval(interval)
  }, [task])
 
  // UPDATE — PATCH then lift updated task up to ProjectDetail
  function handleUpdate(e) {
    e.preventDefault()
    authFetch(`/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name:        form.name,
        description: form.description || null,
        est_minutes: Number(form.est_minutes),
      }),
    })
      .then(r => r.json())
      .then(updated => { onUpdate(updated); setEditing(false) })
  }
 
  return (
    <div className={`task-card ${task.completed ? 'completed' : ''} ${task.is_blocked ? 'blocked' : ''}`}>
      {editing ? (
        <form onSubmit={handleUpdate} className="inline-form">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <label>Minutes
            <input type="number" min="1" value={form.est_minutes} onChange={e => setForm(f => ({ ...f, est_minutes: e.target.value }))} required />
          </label>
          <div className="btn-row">
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="task-header">
            <div className="task-name-row">
              {!task.completed && !task.is_blocked && (
                <button onClick={() => onComplete(task.id)} className="complete-btn" title="Mark complete">✓</button>
              )}
              <span className={`task-name ${task.completed ? 'strikethrough' : ''}`}>{task.name}</span>
            </div>
 
            <div className="task-badges">
              <span className="xp-badge">+{task.xp_value} XP</span>
              {task.is_timed && secondsLeft !== null && !task.completed && (
                <span className={`timer-badge ${secondsLeft < 300 ? 'urgent' : ''}`}>⏱ {formatTime(secondsLeft)}</span>
              )}
              {task.is_blocked && <span className="blocked-badge">🔒 Blocked</span>}
              {task.completed  && <span className="done-badge">✓ Done</span>}
            </div>
          </div>
 
          {task.description && <p className="task-desc muted">{task.description}</p>}
 
          {isOwner && !task.completed && (
            <div className="task-actions">
              <button onClick={() => setEditing(true)}  className="text-btn">Edit</button>
              <button onClick={() => onDelete(task.id)} className="text-btn danger">Delete</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}