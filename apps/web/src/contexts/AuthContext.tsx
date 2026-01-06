import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, type AuthUser } from '../services/api'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  googleLogin: (credential: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check for existing token on mount
  useEffect(() => {
    const token = api.getToken()
    if (token) {
      api.getCurrentUser()
        .then(({ data }) => {
          setUser(data)
        })
        .catch(() => {
          api.logout()
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const { user } = await api.login(email, password)
      setUser(user)
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그인에 실패했습니다.'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const googleLogin = useCallback(async (credential: string) => {
    setError(null)
    setIsLoading(true)
    try {
      const { user } = await api.googleLogin(credential)
      setUser(user)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google 로그인에 실패했습니다.'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    api.logout()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.getCurrentUser()
      setUser(data)
    } catch {
      // Silently fail if refresh fails
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    login,
    googleLogin,
    logout,
    refreshUser,
    error,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
