import { useState } from 'react'
import { Link } from 'react-router'
import { useUser, API } from '../context/UserContext'

const TIER_EMOJI = { dungeon: '🏰', boss: '💀', miniboss: '⚔️' }

export default function ProjectCard({ project, onDelete, onUpdate }) {
  const { user }        = useUser()
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ name: project.name, description: project.description || '' })
  const isOwner = project.creator_id === user.id || user.is_admin

  // UPDATE — PATCH then lift updated project up to Dashboard
  function handleUpdate(e) {
    e.preventDefault()
    fetch(`${API}/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    })
      .then(r => r.json())
      .then(updated => { onUpdate(updated); setEditing(false) })
  }

  return (
    <div className={`project-card tier-${project.tier}`}>
      <div className="card-header">
        <span className="tier-badge">{TIER_EMOJI[project.tier]} {project.tier}</span>
        {isOwner && !editing && (
          <div className="card-actions">
            <button onClick={() => setEditing(true)}     className="icon-btn"        title="Edit">✏️</button>
            <button onClick={() => onDelete(project.id)} className="icon-btn danger" title="Delete">🗑️</button>
          </div>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleUpdate} className="inline-form">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="btn-row">
            <button type="submit">Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <Link to={`/projects/${project.id}`} className="card-body">
          <h3>{project.name}</h3>
          {project.description && <p className="muted">{project.description}</p>}
          <div className="card-meta">
            <span>{project.task_count} task{project.task_count !== 1 ? 's' : ''}</span>
            <span>{project.xp_earned} / {project.xp_max} XP</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${project.progress_pct}%` }} />
          </div>
        </Link>
      )}
    </div>
  )
}