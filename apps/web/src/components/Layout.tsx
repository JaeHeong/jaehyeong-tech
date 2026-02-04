import { useEffect } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import MouseSparkle from './MouseSparkle'
import PageTracker from './PageTracker'
import AdSense from './AdSense'
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

  // Pages where ads should not be shown
  const noAdsPaths = ['/admin', '/login', '/my/', '/suspended']
  const shouldShowAds = !noAdsPaths.some(path => pathname.startsWith(path))

  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen">
      <PageTracker />
      <MouseSparkle />
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />

      {/* Left Side Ad - Fixed position, visible only on wide screens (1400px+) */}
      {shouldShowAds && (
        <div className="hidden 2xl:block fixed left-4 top-1/2 -translate-y-1/2 z-40">
          <div className="sticky top-24">
            <AdSense
              slot="2169621198"
              format="vertical"
              style={{ width: '160px', height: '600px' }}
              className="rounded-lg overflow-hidden"
            />
          </div>
        </div>
      )}
    </div>
  )
}
