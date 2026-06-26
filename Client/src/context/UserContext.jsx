import { createContext, useContext, useState, useEffect, useCallback } from 'react'
 
const API_BASE = import.meta.env.VITE_API_URL || '/api'
export const API = API_BASE.replace(/\/$/, '')
 
const TOKEN_KEY = 'questlog_token'
 
const UserContext = createContext(null)
 
export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)
 
  // Attaches the JWT to every protected request. Use this instead of raw
  // fetch() for any endpoint that requires login_required()/admin_required().
  const authFetch = useCallback((path, options = {}) => {
    const headers = { ...(options.headers || {}) }
    if (token) headers['Authorization'] = `Bearer ${token}`
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
    return fetch(`${API}${path}`, { ...options, headers })
  }, [token])
 
  // Re-hydrate the session on page load using the stored token (no more cookie).
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    fetch(`${API}/check_session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) {
          // token expired/invalid — clear it
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
        setUser(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [token])
 
  function storeToken(accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken)
    setToken(accessToken)
  }
 
  const login = useCallback((email, password) => {
    return fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      .then(data => {
        const { access_token, ...userData } = data
        storeToken(access_token)
        setUser(userData)
        return userData
      })
  }, [])
 
  const register = useCallback((name, email, password) => {
    return fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      .then(data => {
        const { access_token, ...userData } = data
        storeToken(access_token)
        setUser(userData)
        return userData
      })
  }, [])
 
  const logout = useCallback(() => {
    // Stateless JWT — logging out just means discarding the token client-side.
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
    return Promise.resolve()
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
    <UserContext.Provider value={{ user, loading, login, register, logout, setUser, updateUserXP, authFetch }}>
      {children}
    </UserContext.Provider>
  )
}
 
export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within a UserProvider')
  return context
}