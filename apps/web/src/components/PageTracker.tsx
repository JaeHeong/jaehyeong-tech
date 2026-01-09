import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Declare gtag as global function
declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void
  }
}

export default function PageTracker() {
  const location = useLocation()
  const { isAdmin, isLoading } = useAuth()
  const prevPathRef = useRef<string | null>(null)

  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return

    // Skip if admin
    if (isAdmin) return

    // Skip if same path (prevent duplicate tracking)
    if (prevPathRef.current === location.pathname) return

    // Track page view
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_path: location.pathname,
        page_location: window.location.href,
        page_title: document.title,
      })
    }

    prevPathRef.current = location.pathname
  }, [location.pathname, isAdmin, isLoading])

  return null
}
