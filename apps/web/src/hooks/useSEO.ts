import { useEffect } from 'react'

interface SEOProps {
  title?: string
  description?: string
  url?: string
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
  author?: string
}

const SITE_NAME = 'Jaehyeong Tech'
const DEFAULT_DESCRIPTION = 'DevOps, MLOps, 클라우드 인프라 기술 블로그'
const BASE_URL = 'https://tech.jaehyeong.site'

function updateMetaTag(property: string, content: string, isName = false) {
  const selector = isName ? `meta[name="${property}"]` : `meta[property="${property}"]`
  let meta = document.querySelector(selector)

  if (!meta) {
    meta = document.createElement('meta')
    if (isName) {
      meta.setAttribute('name', property)
    } else {
      meta.setAttribute('property', property)
    }
    document.head.appendChild(meta)
  }

  meta.setAttribute('content', content)
}

function updateLinkTag(rel: string, href: string) {
  let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null

  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.appendChild(link)
  }

  link.href = href
}

export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  url,
  image,
  type = 'website',
  publishedTime,
  author,
}: SEOProps) {
  useEffect(() => {
    // Update document title
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    document.title = fullTitle

    // Update meta description
    updateMetaTag('description', description, true)

    // Update canonical URL
    const canonicalUrl = url ? `${BASE_URL}${url}` : BASE_URL
    updateLinkTag('canonical', canonicalUrl)

    // Update OpenGraph tags
    updateMetaTag('og:title', fullTitle)
    updateMetaTag('og:description', description)
    updateMetaTag('og:url', canonicalUrl)
    updateMetaTag('og:type', type)
    updateMetaTag('og:site_name', SITE_NAME)

    if (image) {
      updateMetaTag('og:image', image)
    }

    // Update Twitter Card tags
    updateMetaTag('twitter:title', fullTitle, true)
    updateMetaTag('twitter:description', description, true)

    if (image) {
      updateMetaTag('twitter:image', image, true)
    }

    // Article-specific meta tags
    if (type === 'article') {
      if (publishedTime) {
        updateMetaTag('article:published_time', publishedTime)
      }
      if (author) {
        updateMetaTag('article:author', author)
      }
    }

    // Cleanup function to reset to defaults
    return () => {
      document.title = SITE_NAME
      updateMetaTag('description', DEFAULT_DESCRIPTION, true)
      updateMetaTag('og:title', SITE_NAME)
      updateMetaTag('og:description', DEFAULT_DESCRIPTION)
      updateMetaTag('og:url', BASE_URL)
      updateMetaTag('og:type', 'website')
      updateMetaTag('twitter:title', SITE_NAME, true)
      updateMetaTag('twitter:description', DEFAULT_DESCRIPTION, true)
    }
  }, [title, description, url, image, type, publishedTime, author])
}
