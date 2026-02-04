import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

interface AdSenseProps {
  slot: string
  format?: 'auto' | 'vertical' | 'horizontal'
  style?: React.CSSProperties
  className?: string
}

declare global {
  interface Window {
    adsbygoogle: unknown[]
  }
}

export default function AdSense({
  slot,
  format = 'auto',
  style,
  className = ''
}: AdSenseProps) {
  const adRef = useRef<HTMLModElement>(null)
  const location = useLocation()
  const isInitialized = useRef(false)

  useEffect(() => {
    // Only initialize once per mount
    if (isInitialized.current) return

    try {
      // Push ad only if adsbygoogle is available
      if (typeof window !== 'undefined' && adRef.current) {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
        isInitialized.current = true
      }
    } catch (error) {
      console.error('AdSense error:', error)
    }
  }, [])

  // Reset on route change for new ad load
  useEffect(() => {
    isInitialized.current = false
  }, [location.pathname])

  return (
    <ins
      ref={adRef}
      className={`adsbygoogle ${className}`}
      style={{ display: 'block', ...style }}
      data-ad-client="ca-pub-6534924804736684"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  )
}
