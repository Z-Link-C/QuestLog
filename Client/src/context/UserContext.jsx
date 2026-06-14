import { createContext, useContext, useState, useEffect, useCallback } from 'react'

// Use relative path for Vite proxy routing
export const API = '/api'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Re-hydrate session on page load
  useEffect(() => {
    fetch(`${API}/check_session`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const login = useCallback((email, password) => {
    return fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
      .then(async r => {
        const data = await r.json().catch(() => null)
        if (!r.ok) {
          const message = typeof data?.error === 'string'
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : 'Login failed'
          throw new Error(message)
        }
        return data
      })
      .then(setUser)
  }, [])

  const register = useCallback((name, email, password) => {
    return fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password }),
    })
      .then(async r => {
        const data = await r.json().catch(() => null)
        if (!r.ok) {
          const message = typeof data?.error === 'string'
            ? data.error
            : data?.error
              ? JSON.stringify(data.error)
              : 'Registration failed'
          throw new Error(message)
        }
        return data
      })
      .then(setUser)
  }, [])

  const logout = useCallback(() => {
    return fetch(`${API}/logout`, { method: 'DELETE', credentials: 'include' })
      .then(() => setUser(null))
  }, [])

  // Instantly broadcasts a clean, modified state clone to update external components like NavBar
  const updateUserXP = useCallback((newXp) => {
    setUser(prevUser => {
      if (!prevUser) return null
      return {
        ...prevUser,
        xp_total: newXp
      }
    })
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, login, register, logout, setUser, updateUserXP }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within a UserProvider')
  return context
}