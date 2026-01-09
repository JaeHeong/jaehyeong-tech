import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import MouseSparkle from './MouseSparkle'
import PageTracker from './PageTracker'

export default function Layout() {
  const { pathname } = useLocation()

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

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
