import { useState, useEffect } from 'react'
import { useUser, API } from '../context/UserContext'
import ProjectCard from '../components/ProjectCard'

export default function Dashboard() {
  const { user } = useUser()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })

  // READ — fetch all projects for this user
  useEffect(() => {
    fetch(`${API}/projects`, { credentials: 'include' })
      .then(r => r.json())
      .then(setProjects)
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  // CREATE
  function createProject(e) {
    e.preventDefault()
    fetch(`${API}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newProject),
    })
      .then(r => r.json())
      .then(p => {
        setProjects(prev => [...prev, p])
        setNewProject({ name: '', description: '' })
        setShowForm(false)
      })
  }
  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    login(form.email, form.password)
      .then(() => navigate('/'))
      // Fix: Force error to be a string message, not an object
      .catch(err => setError(err?.message || String(err))) 
      .finally(() => setLoading(false))
  }
  // DELETE — called from ProjectCard
  function deleteProject(id) {
    fetch(`${API}/projects/${id}`, { method: 'DELETE', credentials: 'include' })
      .then(() => setProjects(prev => prev.filter(p => p.id !== id)))
  }

  // UPDATE — called from ProjectCard after a PATCH
  function updateProject(updated) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  if (loading) return <div className="loading">Loading quests...</div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Your quests</h1>
          <p className="muted">{projects.length} project{projects.length !== 1 ? 's' : ''} active</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary">
          {showForm ? 'Cancel' : '+ New project'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {showForm && (
        <form className="inline-form" onSubmit={createProject}>
          <input
            placeholder="Project name"
            value={newProject.name}
            onChange={e => setNewProject(f => ({ ...f, name: e.target.value }))}
            required
          />
          <input
            placeholder="Description (optional)"
            value={newProject.description}
            onChange={e => setNewProject(f => ({ ...f, description: e.target.value }))}
          />
          <button type="submit">Create</button>
        </form>
      )}

      {projects.length === 0
        ? <div className="empty-state"><p>No projects yet. Create one to start earning XP.</p></div>
        : (
          <div className="project-grid">
            {projects.map(p => (
              <ProjectCard key={p.id} project={p} onDelete={deleteProject} onUpdate={updateProject} />
            ))}
          </div>
        )
      }
    </div>
  )
}