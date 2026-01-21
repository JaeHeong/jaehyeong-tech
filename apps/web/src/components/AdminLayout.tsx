import { Link, useLocation, Outlet } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import Footer from './Footer'
import RadialWheelMenu from './RadialWheelMenu'
import api from '../services/api'

interface SidebarStats {
  publishedPosts: number
  privatePosts: number
  draftPosts: number
  totalCategories: number
  totalTags: number
  totalPages: number
  newComments: number
  totalComments: number
}

type BadgeKey = 'posts' | 'categories' | 'tags' | 'pages' | 'drafts' | 'comments'

const baseSidebarItems: Array<{
  path: string
  icon: string
  label: string
  exact?: boolean
  badgeKey?: BadgeKey
}> = [
  { path: '/admin', icon: 'dashboard', label: '대시보드 홈', exact: true },
  { path: '/admin/analytics', icon: 'analytics', label: '보고서 개요' },
  { path: '/admin/posts', icon: 'article', label: '게시물 관리', badgeKey: 'posts' },
  { path: '/admin/categories', icon: 'category', label: '카테고리 관리', badgeKey: 'categories' },
  { path: '/admin/tags', icon: 'sell', label: '태그 관리', badgeKey: 'tags' },
  { path: '/admin/pages', icon: 'description', label: '페이지 관리', badgeKey: 'pages' },
  { path: '/admin/drafts', icon: 'edit_note', label: '임시 저장 글', badgeKey: 'drafts' },
  { path: '/admin/comments', icon: 'chat', label: '댓글 관리', badgeKey: 'comments' },
  { path: '/admin/users', icon: 'group', label: '사용자 관리' },
  { path: '/admin/management', icon: 'storage', label: '시스템 관리' },
  { path: '/admin/settings', icon: 'settings', label: '설정' },
]

// Polling interval for stats refresh (30 seconds)
const STATS_POLLING_INTERVAL = 30000

export default function AdminLayout() {
  const location = useLocation()
  const { logout, user } = useAuth()
  const [stats, setStats] = useState<SidebarStats | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.getDashboardStats()
      setStats({
        publishedPosts: response.stats.publishedPosts,
        privatePosts: response.stats.privatePosts,
        draftPosts: response.stats.draftPosts,
        totalCategories: response.categories.length,
        totalTags: response.tags.length,
        totalPages: response.pages.static + response.pages.notice,
        newComments: response.stats.newComments,
        totalComments: response.stats.totalComments,
      })
    } catch {
      // Silently fail - badges just won't show
    }
  }, [])

  // Initial fetch + polling every 30 seconds
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, STATS_POLLING_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchStats])

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => {
      fetchStats()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchStats])

  // Refresh on route change within admin
  useEffect(() => {
    fetchStats()
  }, [location.pathname, fetchStats])

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Check if we're on the post editor page (full width mode)
  const isEditorPage = location.pathname.includes('/posts/new') ||
    /\/posts\/[^/]+\/edit/.test(location.pathname) ||
    /\/drafts\/[^/]+\/edit/.test(location.pathname)

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Shared Header */}
      <Header />

      {/* Main Content */}
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isEditorPage ? 'max-w-[1600px]' : 'max-w-7xl'}`}>
        <div className={`grid grid-cols-1 gap-8 ${isEditorPage ? '' : 'lg:grid-cols-12'}`}>
          {/* Sidebar - hidden on editor page and mobile */}
          {!isEditorPage && (
          <aside className="hidden lg:block lg:col-span-3 space-y-4">
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Dashboard
                </h2>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                {baseSidebarItems.map((item) => {
                  // Determine badge based on badgeKey and stats
                  let badge: { text: string; isNew: boolean; secondary?: string } | null = null
                  if (stats && item.badgeKey) {
                    switch (item.badgeKey) {
                      case 'posts':
                        if (stats.publishedPosts > 0 || stats.privatePosts > 0) {
                          badge = {
                            text: stats.publishedPosts.toString(),
                            isNew: false,
                            secondary: stats.privatePosts > 0 ? `+${stats.privatePosts}` : undefined,
                          }
                        }
                        break
                      case 'categories':
                        if (stats.totalCategories > 0) badge = { text: stats.totalCategories.toString(), isNew: false }
                        break
                      case 'tags':
                        if (stats.totalTags > 0) badge = { text: stats.totalTags.toString(), isNew: false }
                        break
                      case 'pages':
                        if (stats.totalPages > 0) badge = { text: stats.totalPages.toString(), isNew: false }
                        break
                      case 'drafts':
                        if (stats.draftPosts > 0) badge = { text: stats.draftPosts.toString(), isNew: false }
                        break
                      case 'comments':
                        if (stats.newComments > 0) {
                          badge = { text: 'New', isNew: true }
                        } else if (stats.totalComments > 0) {
                          badge = { text: stats.totalComments.toString(), isNew: false }
                        }
                        break
                    }
                  }

                  return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive(item.path, item.exact)
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    {item.label}
                    {badge && (
                      <div className="ml-auto flex items-center gap-1">
                        <span className={`text-xs py-0.5 px-2 rounded-full font-bold ${
                          badge.isNew
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}>
                          {badge.text}
                        </span>
                        {badge.secondary && (
                          <span className="text-[10px] py-0.5 px-1.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[10px]">visibility_off</span>
                            {badge.secondary}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                  )
                })}
              </nav>
            </div>

            {/* User Info & Logout */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="size-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {user?.name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{user?.name || 'Admin'}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                로그아웃
              </button>
            </div>
          </aside>
          )}

          {/* Main Content Area */}
          <main className={`flex flex-col gap-6 ${isEditorPage ? '' : 'lg:col-span-9'}`}>
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile Radial Wheel Menu - hidden on editor page */}
      {!isEditorPage && <RadialWheelMenu />}

      <Footer />
    </div>
  )
}
