import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const [isDark, setIsDark] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { isAdmin, isAuthenticated, user, logout } = useAuth()
  const navigate = useNavigate()
  const userMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Alt + / shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '/') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const toggleDarkMode = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  const navLinks = [
    { to: '/', label: '홈' },
    { to: '/notices', label: '공지사항' },
    { to: '/introduce', label: '소개' },
    { to: '/posts', label: '글 목록' },
    { to: '/categories', label: '카테고리' },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
      <div className="container-wrapper">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" onClick={() => window.scrollTo(0, 0)} className="group flex items-center gap-3 shrink-0 cursor-pointer">
            <div className="flex items-center justify-center size-8 rounded bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[24px] group-hover:animate-terminal-wiggle">terminal</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              jaehyeong<span className="text-primary"> tech</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden tablet:flex flex-1 items-center justify-end gap-6">
            <nav className="flex gap-6 mr-4">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-primary' : 'hover:text-primary'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3 pl-6 border-l border-slate-200 dark:border-slate-800">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative w-64 group">
                <button
                  type="submit"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary hover:text-primary transition-colors text-[20px]">
                    search
                  </span>
                </button>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색 (Alt + /)"
                  className="block w-full py-1.5 pl-4 pr-10 rounded-full bg-slate-100 dark:bg-slate-800/50 border border-transparent focus:border-primary/50 text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </form>

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {isDark ? 'light_mode' : 'dark_mode'}
                </span>
              </button>

              {/* User Menu / Login Button */}
              {isAuthenticated ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name || 'User'}
                        className="size-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                      </div>
                    )}
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {user?.name || '사용자'}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user?.email}
                        </p>
                      </div>
                      {isAdmin && (
                        <>
                          <Link
                            to="/admin"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <span className="material-symbols-outlined text-[18px]">dashboard</span>
                            대시보드
                          </Link>
                          <Link
                            to="/admin/posts/new"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit_note</span>
                            새 글 작성
                          </Link>
                          <Link
                            to="/admin/settings"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <span className="material-symbols-outlined text-[18px]">settings</span>
                            설정
                          </Link>
                        </>
                      )}
                      <div className={isAdmin ? "border-t border-slate-200 dark:border-slate-700 mt-1 pt-1" : ""}>
                        <button
                          onClick={() => {
                            logout()
                            setIsUserMenuOpen(false)
                            navigate('/')
                          }}
                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span className="material-symbols-outlined text-[18px]">logout</span>
                          로그아웃
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  로그인
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="flex tablet:hidden items-center gap-2">
            <button
              onClick={() => navigate('/search')}
              className="p-2 text-slate-500 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            {isAuthenticated && (
              user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'User'}
                  className="size-7 rounded-full object-cover"
                />
              ) : (
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                </div>
              )
            )}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-500"
            >
              <span className="material-symbols-outlined">
                {isMobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="tablet:hidden py-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-primary bg-primary/10'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              {/* User Section in Mobile Menu */}
              <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
              {isAuthenticated ? (
                <>
                  <div className="px-4 py-2 flex items-center gap-3">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name || 'User'}
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {user?.name || '사용자'}
                      </p>
                      <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <>
                      <Link
                        to="/admin"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined text-[18px]">dashboard</span>
                        대시보드
                      </Link>
                      <Link
                        to="/admin/posts/new"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit_note</span>
                        새 글 작성
                      </Link>
                      <Link
                        to="/admin/settings"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined text-[18px]">settings</span>
                        설정
                      </Link>
                    </>
                  )}
                  <button
                    onClick={() => {
                      logout()
                      setIsMobileMenuOpen(false)
                      navigate('/')
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    로그아웃
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  로그인
                </Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
