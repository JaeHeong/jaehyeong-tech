import useSWR, { SWRConfiguration } from 'swr'
import { api } from '../services/api'

// Global SWR configuration
export const swrConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 5000, // Dedupe requests within 5 seconds
  errorRetryCount: 2,
}

// Posts hooks
export function usePosts(params?: {
  page?: number
  limit?: number
  category?: string
  tag?: string
  search?: string
  status?: 'PUBLISHED' | 'PRIVATE' | 'PUBLIC' | 'ALL'
  sortBy?: string
  featured?: boolean
}) {
  const key = params ? ['posts', JSON.stringify(params)] : ['posts']

  return useSWR(
    key,
    () => api.getPosts(params),
    {
      ...swrConfig,
      revalidateOnMount: true,
    }
  )
}

export function usePost(slug: string | undefined) {
  return useSWR(
    slug ? ['post', slug] : null,
    () => api.getPost(slug!),
    {
      ...swrConfig,
      revalidateOnMount: true,
    }
  )
}

export function useAdjacentPosts(slug: string | undefined) {
  return useSWR(
    slug ? ['adjacent-posts', slug] : null,
    () => api.getAdjacentPosts(slug!),
    swrConfig
  )
}

export function useRelatedPosts(slug: string | undefined) {
  return useSWR(
    slug ? ['related-posts', slug] : null,
    () => api.getRelatedPosts(slug!),
    swrConfig
  )
}

export function useFeaturedPosts() {
  return useSWR(
    'featured-posts',
    () => api.getFeaturedPosts(),
    {
      ...swrConfig,
      dedupingInterval: 30000, // 30 seconds for featured
    }
  )
}

export function useTopViewedPost(category?: string) {
  return useSWR(
    ['top-viewed', category],
    () => api.getTopViewedPost(category),
    {
      ...swrConfig,
      dedupingInterval: 30000,
    }
  )
}

// Categories hooks
export function useCategories() {
  return useSWR(
    'categories',
    () => api.getCategories(),
    {
      ...swrConfig,
      dedupingInterval: 60000, // 1 minute for categories (rarely change)
    }
  )
}

// Tags hooks
export function useTags() {
  return useSWR(
    'tags',
    () => api.getTags(),
    {
      ...swrConfig,
      dedupingInterval: 60000,
    }
  )
}

// Author hooks
export function useAuthorInfo() {
  return useSWR(
    'author-info',
    () => api.getAuthorInfo(),
    {
      ...swrConfig,
      dedupingInterval: 300000, // 5 minutes for author info
    }
  )
}

// Pages/Notices hooks
export function useNotices(params?: { page?: number; limit?: number }) {
  const key = params ? ['notices', JSON.stringify(params)] : ['notices']
  return useSWR(
    key,
    () => api.getNotices(params),
    swrConfig
  )
}

export function usePageBySlug(slug: string | undefined) {
  return useSWR(
    slug ? ['page', slug] : null,
    () => api.getPageBySlug(slug!),
    swrConfig
  )
}

// Visitor stats hook
export function useVisitorStats() {
  return useSWR(
    'visitor-stats',
    () => api.getVisitorStats(),
    {
      ...swrConfig,
      dedupingInterval: 60000,
    }
  )
}

// Recent comments hook
export function useRecentComments(limit: number = 5) {
  return useSWR(
    ['recent-comments', limit],
    () => api.getRecentComments(limit),
    {
      ...swrConfig,
      dedupingInterval: 30000,
    }
  )
}

// Comments hook
export function useComments(postId: string | undefined) {
  return useSWR(
    postId ? ['comments', postId] : null,
    () => api.getComments(postId!),
    {
      ...swrConfig,
      revalidateOnMount: true,
    }
  )
}

// Dashboard stats (admin)
export function useDashboardStats() {
  return useSWR(
    'dashboard-stats',
    () => api.getDashboardStats(),
    {
      ...swrConfig,
      revalidateOnMount: true,
    }
  )
}

// Weekly visitors analytics
export function useWeeklyVisitors() {
  return useSWR(
    'weekly-visitors',
    () => api.getWeeklyVisitors(),
    {
      ...swrConfig,
      dedupingInterval: 60000,
    }
  )
}
