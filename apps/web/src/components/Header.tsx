import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
  const [isDark, setIsDark] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

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
    { to: '/introduce', label: '소개' },
    { to: '/posts', label: '글 목록' },
    { to: '/categories', label: '카테고리' },
  ]

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
      <div className="container-wrapper">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="flex items-center justify-center size-8 rounded bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[24px]">terminal</span>
            </div>
            <span className="text-xl font-bold tracking-tight">
              jaehyeong<span className="text-primary"> tech</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex flex-1 items-center justify-end gap-6">
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
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors text-[20px]">
                    search
                  </span>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="검색어를 입력하세요..."
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

              {/* Admin Icons */}
              {isAdmin && (
                <>
                  <Link
                    to="/admin/posts/new"
                    className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="새 글 작성"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                  </Link>
                  <Link
                    to="/admin"
                    className="p-2 text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="관리자 설정"
                  >
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden items-center gap-2">
            <button className="p-2 text-slate-500">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
            {isAdmin && (
              <>
                <Link
                  to="/admin/posts/new"
                  className="p-2 text-slate-500 hover:text-primary"
                  title="새 글 작성"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </Link>
                <Link
                  to="/admin"
                  className="p-2 text-slate-500 hover:text-primary"
                  title="관리자 설정"
                >
                  <span className="material-symbols-outlined text-[20px]">settings</span>
                </Link>
              </>
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
          <nav className="md:hidden py-4 border-t border-slate-200 dark:border-slate-800">
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
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
