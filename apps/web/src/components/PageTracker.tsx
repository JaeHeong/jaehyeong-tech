import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const GA_MEASUREMENT_ID = 'G-8BJSXQ1XQX'

// Declare gtag as global function
declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void
    dataLayer: unknown[]
  }
}

// Track if gtag has been loaded (module-level singleton)
let gtagLoaded = false
let gtagLoadPromise: Promise<void> | null = null

function loadGtag(): Promise<void> {
  if (gtagLoaded) return Promise.resolve()
  if (gtagLoadPromise) return gtagLoadPromise

  gtagLoadPromise = new Promise((resolve) => {
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })

    // Load gtag.js script
    const script = document.createElement('script')
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
    script.async = true
    script.onload = () => {
      gtagLoaded = true
      resolve()
    }
    document.head.appendChild(script)
  })

  return gtagLoadPromise
}

export default function PageTracker() {
  const location = useLocation()
  const { isAdmin, isLoading } = useAuth()
  const prevPathRef = useRef<string | null>(null)
  const [isGtagReady, setIsGtagReady] = useState(gtagLoaded)

  // Initialize gtag for non-admin users
  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return

    // Skip gtag initialization for admin
    if (isAdmin) return

    // Load gtag if not already loaded
    if (!gtagLoaded) {
      loadGtag().then(() => {
        setIsGtagReady(true)
      })
    }
  }, [isAdmin, isLoading])

  // Track page views
  useEffect(() => {
    // Wait for auth check to complete
    if (isLoading) return

    // Skip if admin
    if (isAdmin) return

    // Wait for gtag to be ready
    if (!isGtagReady || typeof window.gtag !== 'function') return

    // Skip if same path (prevent duplicate tracking)
    if (prevPathRef.current === location.pathname) return

    // Track page view
    window.gtag('event', 'page_view', {
      page_path: location.pathname,
      page_location: window.location.href,
      page_title: document.title,
    })

    prevPathRef.current = location.pathname
  }, [location.pathname, isAdmin, isLoading, isGtagReady])

  return null
}
