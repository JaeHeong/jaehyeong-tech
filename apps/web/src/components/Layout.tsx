import { useEffect } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import MouseSparkle from './MouseSparkle'
import PageTracker from './PageTracker'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { pathname } = useLocation()
  const { isSuspended, isAuthenticated } = useAuth()

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Redirect suspended users to suspended page
  if (isAuthenticated && isSuspended) {
    return <Navigate to="/suspended" replace />
  }

  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen">
      <PageTracker />
      <MouseSparkle />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
