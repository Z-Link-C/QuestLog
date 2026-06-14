import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUser, API } from '../context/UserContext'
import TaskCard from '../components/TaskCard'

const TIER_EMOJI = { dungeon: '🏰', boss: '🐉', miniboss: '💀' }

export default function ProjectDetail() {
  const { id } = useParams()
  
  // Custom context hooks safely extracted within the structural lifecycle scope
  const { user, updateUserXP } = useUser() 
  
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newTask, setNewTask]   = useState({ name: '', description: '', est_minutes: 30, is_timed: false, deadline: '' })

  // READ project + its tasks
  useEffect(() => {
    fetch(`${API}/projects/${id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { 
        setProject(data)
        setTasks(data.tasks || [])
        setLoading(false) 
      })
      .catch(() => { setError('Project not found'); setLoading(false) })
  }, [id])

  // CREATE task
  function createTask(e) {
    e.preventDefault()
    fetch(`${API}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        name: newTask.name,
        description: newTask.description,
        est_minutes: parseInt(newTask.est_minutes) || 0,
        is_timed: newTask.is_timed,
        deadline: newTask.is_timed ? newTask.deadline : null,
        project_id: parseInt(id) 
      }),
    })
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e.error || 'Failed to create task'))
        return r.json()
      })
      .then(createdTask => {
        setTasks(prevTasks => [...prevTasks, createdTask])
        setProject(prevProj => {
          if (!prevProj) return null
          return {
            ...prevProj,
            task_count: (prevProj.task_count || 0) + 1,
            xp_max: (prevProj.xp_max || 0) + (createdTask.xp_value || 0)
          }
        })
        setNewTask({ name: '', description: '', est_minutes: 30, is_timed: false, deadline: '' })
        setShowForm(false)
      })
      .catch(err => setError(typeof err === 'string' ? err : 'Could not add task.'))
  }

  // DELETE task — called from TaskCard
  function deleteTask(taskId) {
    fetch(`${API}/tasks/${taskId}`, { method: 'DELETE', credentials: 'include' })
      .then(r => {
        if (r.ok) {
          const removedTask = tasks.find(t => t.id === taskId)
          const lostXP = removedTask ? (removedTask.xp_value || 0) : 0
          setTasks(prev => prev.filter(t => t.id !== taskId))
          setProject(prev => prev ? {
            ...prev,
            task_count: Math.max(0, (prev.task_count || 1) - 1),
            xp_max: Math.max(0, (prev.xp_max || 0) - lostXP)
          } : null)
        }
      })
  }

  // COMPLETE task — awards XP, checks break threshold
  function completeTask(taskId) {
    fetch(`${API}/tasks/${taskId}/complete`, {
      method: 'POST',
      credentials: 'include'
    })
      .then(r => {
        if (!r.ok) return r.json().then(e => Promise.reject(e.error || 'Failed to complete task'))
        return r.json()
      })
      .then(data => {
        const targetTask = tasks.find(t => t.id === taskId)
        const gainedXP = targetTask ? (targetTask.xp_value || 0) : 0

        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true } : t))
        setProject(prev => prev ? {
          ...prev,
          xp_earned: Math.min(prev.xp_max, (prev.xp_earned || 0) + gainedXP)
        } : null)

        // Communicates tracking modifications cleanly across global context trees
        if (data.xp_total !== undefined && typeof updateUserXP === 'function') {
          updateUserXP(data.xp_total)
        }
      })
      .catch(err => setError(typeof err === 'string' ? err : 'Could not complete task.'))
  }

  function updateTask(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  if (loading) return <div className="loading">Loading quest parameters...</div>
  if (error) return <div className="page"><p className="error">{error}</p></div>
  if (!project) return null

  const isOwner = project.creator_id === user?.id || user?.is_admin

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{TIER_EMOJI[project.tier] || '⚔️'} {project.name}</h1>
          <p className="muted">{project.description}</p>
        </div>
        {isOwner && (
          <button onClick={() => setShowForm(s => !s)} className="btn-primary">
            {showForm ? 'Cancel' : '+ Add objective'}
          </button>
        )}
      </div>

      <div className="project-metrics-banner" style={{ marginBottom: '24px', padding: '16px', background: 'var(--code-bg)', borderRadius: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span><strong>Quest Progress:</strong> {project.xp_earned} / {project.xp_max} Total Area XP</span>
          <span><strong>Objectives:</strong> {project.task_count} Active</span>
        </div>
        <div className="xp-bar-track" style={{ width: '100%', height: '12px', background: 'var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
          <div className="xp-bar-fill" style={{ 
            width: `${project.xp_max > 0 ? (project.xp_earned / project.xp_max) * 100 : 0}%`, 
            height: '100%', 
            background: 'var(--accent)',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={createTask}>
          <input placeholder="Task name" value={newTask.name} onChange={e => setNewTask(f => ({ ...f, name: e.target.value }))} required />
          <input placeholder="Description (optional)" value={newTask.description} onChange={e => setNewTask(f => ({ ...f, description: e.target.value }))} />
          <label>Estimated minutes
            <input type="number" min="1" value={newTask.est_minutes} onChange={e => setNewTask(f => ({ ...f, est_minutes: e.target.value }))} required />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={newTask.is_timed} onChange={e => setNewTask(f => ({ ...f, is_timed: e.target.checked }))} />
            Time-sensitive task
          </label>
          {newTask.is_timed && (
            <input type="datetime-local" value={newTask.deadline} onChange={e => setNewTask(f => ({ ...f, deadline: e.target.value }))} required />
          )}
          <button type="submit">Add task</button>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state"><p>No tasks yet. Add one to start fighting this {project.tier}.</p></div>
      ) : (
        <div className="task-list">
          {tasks.map(t => (
            <TaskCard 
              key={t.id} 
              task={t} 
              isOwner={isOwner} 
              onDelete={deleteTask} 
              onComplete={completeTask} 
              onUpdate={updateTask} 
            />
          ))}
        </div>
      )}
    </div>
  )
}