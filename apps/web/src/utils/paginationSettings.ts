// Pagination settings storage keys
const STORAGE_KEY = 'admin_pagination_settings'

export interface PaginationSettings {
  posts: number
  drafts: number
  pages: number
  categories: number
  tags: number
  comments: number
  users: number
}

// Default limits
export const DEFAULT_LIMITS: PaginationSettings = {
  posts: 9,
  drafts: 9,
  pages: 9,
  categories: 9,
  tags: 9,
  comments: 7,
  users: 5,
}

// Available limit options (0 = ALL)
export const LIMIT_OPTIONS = [
  { value: 0, label: 'ALL' },
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
]

export type PageType = keyof PaginationSettings

// Get all pagination settings
export function getPaginationSettings(): PaginationSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_LIMITS, ...parsed }
    }
  } catch {
    // Ignore parsing errors
  }
  return { ...DEFAULT_LIMITS }
}

// Get limit for a specific page
export function getPageLimit(pageType: PageType): number {
  const settings = getPaginationSettings()
  return settings[pageType] || DEFAULT_LIMITS[pageType]
}

// Save all pagination settings
export function savePaginationSettings(settings: PaginationSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors
  }
}

// Update single page limit
export function updatePageLimit(pageType: PageType, limit: number): void {
  const settings = getPaginationSettings()
  settings[pageType] = limit
  savePaginationSettings(settings)
}
