import { useState, useEffect } from 'react'
import { useUser } from '../context/UserContext'
import ProjectCard from '../components/ProjectCard'
 
export default function Dashboard() {
  const { user, authFetch } = useUser()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', })
 
  // READ — fetch all projects for this user
  useEffect(() => {
    authFetch('/projects')
      .then(r => r.json())
      .then(setProjects)
      .catch(() => setError('Failed to load projects'))
      .finally(() => setLoading(false))
  }, [authFetch])
 
  // CREATE
  function createProject(e) {
    e.preventDefault()
    authFetch('/projects', {
        method: 'POST',
        body: JSON.stringify(newProject),
    })
    .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || JSON.stringify(data.errors || data))
        return data
    })
    .then(p => {
        setProjects(prev => [...prev, p])
        setNewProject({ name: '', description: '', tier: 'dungeon', xp_max: 100 })
        setShowForm(false)
    })
    .catch(err => {
        console.error("Project Creation Error:", err.message)
        setError(err.message)
    })
  }
 
  // DELETE — called from ProjectCard
  function deleteProject(id) {
    authFetch(`/projects/${id}`, { method: 'DELETE' })
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