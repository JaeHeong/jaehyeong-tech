import { useEffect } from 'react'

const SCRIPT_ID = 'json-ld-schema'
const BASE_URL = 'https://tech.jaehyeong.com'

// JSON-LD Schema Types
interface WebSiteSchema {
  '@type': 'WebSite'
  name: string
  url: string
  description: string
  potentialAction?: {
    '@type': 'SearchAction'
    target: string
    'query-input': string
  }
}

interface OrganizationSchema {
  '@type': 'Organization'
  name: string
  url: string
  logo: string
  sameAs?: string[]
}

interface BlogPostingSchema {
  '@type': 'BlogPosting'
  headline: string
  description?: string
  image?: string
  datePublished?: string
  dateModified?: string
  author: {
    '@type': 'Person'
    name: string
  }
  publisher: {
    '@type': 'Organization'
    name: string
    logo: {
      '@type': 'ImageObject'
      url: string
    }
  }
  mainEntityOfPage: {
    '@type': 'WebPage'
    '@id': string
  }
}

interface BreadcrumbSchema {
  '@type': 'BreadcrumbList'
  itemListElement: Array<{
    '@type': 'ListItem'
    position: number
    name: string
    item: string
  }>
}

type SchemaType = WebSiteSchema | OrganizationSchema | BlogPostingSchema | BreadcrumbSchema

export function useJsonLd(schema: SchemaType | SchemaType[] | null) {
  useEffect(() => {
    // Remove existing script
    const existingScript = document.getElementById(SCRIPT_ID)
    if (existingScript) {
      existingScript.remove()
    }

    if (!schema) return

    // Create new script
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.type = 'application/ld+json'

    const schemaData = Array.isArray(schema)
      ? { '@context': 'https://schema.org', '@graph': schema }
      : { '@context': 'https://schema.org', ...schema }

    script.textContent = JSON.stringify(schemaData)
    document.head.appendChild(script)

    return () => {
      const script = document.getElementById(SCRIPT_ID)
      if (script) script.remove()
    }
  }, [schema])
}

// Helper functions to create schemas
export const createWebSiteSchema = (): WebSiteSchema => ({
  '@type': 'WebSite',
  name: 'Jaehyeong Tech',
  url: BASE_URL,
  description: 'DevOps, MLOps, 클라우드 인프라 기술 블로그',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE_URL}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
})

export const createOrganizationSchema = (): OrganizationSchema => ({
  '@type': 'Organization',
  name: 'Jaehyeong Tech',
  url: BASE_URL,
  logo: `${BASE_URL}/favicon.svg`,
  sameAs: ['https://github.com/JaeHeong'],
})

export const createBlogPostingSchema = (post: {
  title: string
  excerpt?: string
  coverImage?: string
  publishedAt?: string
  updatedAt?: string
  authorName: string
  slug: string
}): BlogPostingSchema => ({
  '@type': 'BlogPosting',
  headline: post.title,
  description: post.excerpt,
  image: post.coverImage,
  datePublished: post.publishedAt,
  dateModified: post.updatedAt || post.publishedAt,
  author: {
    '@type': 'Person',
    name: post.authorName,
  },
  publisher: {
    '@type': 'Organization',
    name: 'Jaehyeong Tech',
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/favicon.svg`,
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': `${BASE_URL}/posts/${post.slug}`,
  },
})

export const createBreadcrumbSchema = (
  items: Array<{ name: string; url: string }>
): BreadcrumbSchema => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: `${BASE_URL}${item.url}`,
  })),
})
