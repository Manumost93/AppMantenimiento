import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { TeamMember } from '@/types'

interface AuthContextType {
  worker: TeamMember | null
  login: (worker: TeamMember) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>(null!)

const STORAGE_KEY = 'ikea_mant_worker'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [worker, setWorker] = useState<TeamMember | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setWorker(JSON.parse(saved))
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    setIsLoading(false)
  }, [])

  function login(w: TeamMember) {
    setWorker(w)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(w))
  }

  function logout() {
    setWorker(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ worker, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
