import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import Footer from './Footer'

const sidebarItems = [
  { path: '/admin', icon: 'dashboard', label: '대시보드 홈', exact: true },
  { path: '/admin/posts', icon: 'article', label: '게시물 관리' },
  { path: '/admin/categories', icon: 'category', label: '카테고리 관리' },
  { path: '/admin/pages', icon: 'description', label: '페이지 관리' },
  { path: '/admin/drafts', icon: 'edit_note', label: '임시 저장 글', badge: '3' },
  { path: '/admin/comments', icon: 'chat', label: '댓글 관리', badgeType: 'new' },
  { path: '/admin/management', icon: 'storage', label: '시스템 관리' },
  { path: '/admin/settings', icon: 'settings', label: '설정' },
]

export default function AdminLayout() {
  const location = useLocation()
  const { logout, user } = useAuth()

  // Check if we're on the post editor page (full width mode)
  const isEditorPage = location.pathname.includes('/posts/new') ||
    /\/posts\/[^/]+\/edit/.test(location.pathname)

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
          {/* Sidebar - hidden on editor page */}
          {!isEditorPage && (
          <aside className="lg:col-span-3 space-y-4">
            <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Dashboard
                </h2>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                {sidebarItems.map((item) => (
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
                    {item.badge && (
                      <span className="ml-auto bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs py-0.5 px-2 rounded-full font-bold">
                        {item.badge}
                      </span>
                    )}
                    {item.badgeType === 'new' && (
                      <span className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs py-0.5 px-2 rounded-full font-bold">
                        New
                      </span>
                    )}
                  </Link>
                ))}
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

      <Footer />
    </div>
  )
}
