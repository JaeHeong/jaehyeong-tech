import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import api, { AdminUser, UserStats, UserStatus, SignupTrendData, SignupPatternData, SignupTrendPeriod } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import LimitSelector from '../components/LimitSelector'
import { getPageLimit } from '../utils/paginationSettings'

export default function AdminUsersPage() {
  const { alert } = useModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [trendData, setTrendData] = useState<SignupTrendData | null>(null)
  const [patternData, setPatternData] = useState<SignupPatternData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [trendPeriod, setTrendPeriod] = useState<SignupTrendPeriod>('daily')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; user: AdminUser | null }>({
    isOpen: false,
    user: null,
  })
  const [statusModal, setStatusModal] = useState<{ isOpen: boolean; user: AdminUser | null; newStatus: UserStatus | null }>({
    isOpen: false,
    user: null,
    newStatus: null,
  })
  const [profileModal, setProfileModal] = useState<{ isOpen: boolean; user: AdminUser | null }>({
    isOpen: false,
    user: null,
  })

  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const currentStatus = (searchParams.get('status') || 'all') as UserStatus | 'all'
  const defaultLimit = getPageLimit('users')
  const [isAllMode, setIsAllMode] = useState(false)
  const limit = isAllMode ? 0 : defaultLimit

  // Fetch users and stats
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [usersRes, statsRes] = await Promise.all([
          api.getUsers({
            page: limit === 0 ? 1 : currentPage,
            limit: limit === 0 ? 9999 : limit,
            search: searchQuery || undefined,
            status: currentStatus,
          }),
          api.getUserStats(),
        ])
        setUsers(usersRes.data)
        setTotalPages(limit === 0 ? 1 : usersRes.meta.totalPages)
        setTotal(usersRes.meta.total)
        setStats(statsRes)
      } catch (error) {
        console.error('Failed to fetch users:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentPage, currentStatus, searchQuery, limit])

  const handleToggleAll = () => {
    setIsAllMode(!isAllMode)
    setSearchParams((prev) => {
      prev.set('page', '1')
      return prev
    })
  }

  // Fetch trend data when period changes
  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const data = await api.getSignupTrend(trendPeriod)
        setTrendData(data)
      } catch (error) {
        console.error('Failed to fetch trend:', error)
      }
    }
    fetchTrend()
  }, [trendPeriod])

  // Fetch pattern data once
  useEffect(() => {
    const fetchPattern = async () => {
      try {
        const data = await api.getSignupPattern()
        setPatternData(data)
      } catch (error) {
        console.error('Failed to fetch pattern:', error)
      }
    }
    fetchPattern()
  }, [])

  // ESC/Enter key to control modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteModal.isOpen) setDeleteModal({ isOpen: false, user: null })
        if (statusModal.isOpen) setStatusModal({ isOpen: false, user: null, newStatus: null })
        if (profileModal.isOpen) setProfileModal({ isOpen: false, user: null })
      } else if (e.key === 'Enter') {
        if (deleteModal.isOpen) {
          e.preventDefault()
          handleDelete()
        } else if (statusModal.isOpen) {
          e.preventDefault()
          handleStatusChange()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteModal.isOpen, statusModal.isOpen, profileModal.isOpen])

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'all') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    setSearchParams(params)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    setSearchParams(params)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (searchQuery) {
      params.set('search', searchQuery)
    } else {
      params.delete('search')
    }
    params.delete('page')
    setSearchParams(params)
  }

  const handleStatusChange = async () => {
    if (!statusModal.user || !statusModal.newStatus) return
    try {
      const updatedUser = await api.updateUserStatus(statusModal.user.id, statusModal.newStatus)
      setUsers(users.map(u => u.id === updatedUser.id ? { ...u, status: updatedUser.status } : u))
      setStatusModal({ isOpen: false, user: null, newStatus: null })
      const statsRes = await api.getUserStats()
      setStats(statsRes)
    } catch (error) {
      console.error('Failed to update user status:', error)
      await alert({ message: error instanceof Error ? error.message : '상태 변경에 실패했습니다.', type: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deleteModal.user) return
    try {
      await api.deleteUser(deleteModal.user.id)
      setUsers(users.filter(u => u.id !== deleteModal.user?.id))
      setDeleteModal({ isOpen: false, user: null })
      const statsRes = await api.getUserStats()
      setStats(statsRes)
    } catch (error) {
      console.error('Failed to delete user:', error)
      await alert({ message: error instanceof Error ? error.message : '사용자 삭제에 실패했습니다.', type: 'error' })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(p => p.length > 0)
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? ''
      const second = parts[1]?.[0] ?? ''
      return (first + second).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const formatChange = (current: number, previous: number) => {
    const diff = current - previous
    const percent = previous > 0 ? ((diff / previous) * 100).toFixed(1) : (current > 0 ? '100' : '0')
    const sign = diff >= 0 ? '+' : ''
    return { diff, percent, sign, isPositive: diff >= 0 }
  }

  const getPeriodLabel = (period: SignupTrendPeriod) => {
    switch (period) {
      case 'daily': return '일간'
      case 'weekly': return '주간'
      case 'monthly': return '월간'
    }
  }

  const getSummaryLabel = (period: SignupTrendPeriod) => {
    switch (period) {
      case 'daily': return { total: '14일 총계', avg: '일 평균' }
      case 'weekly': return { total: '8주 총계', avg: '주 평균' }
      case 'monthly': return { total: '6개월 총계', avg: '월 평균' }
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">사용자 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5 md:mt-1">
            전체 사용자를 관리합니다.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">전체 사용자</p>
            <div className="p-1.5 md:p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <span className="material-symbols-outlined text-[18px] md:text-[22px]">group</span>
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold">{stats?.totalUsers.toLocaleString() ?? '-'}</h3>
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">오늘 신규</p>
            <div className="p-1.5 md:p-2 bg-green-500/10 rounded-lg text-green-500">
              <span className="material-symbols-outlined text-[18px] md:text-[22px]">person_add</span>
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold">{stats?.todayNewUsers ?? '-'}</h3>
          {stats && (
            <p className={`text-[10px] md:text-xs mt-1 ${formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
              전일 대비 {formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).sign}{formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).diff}명
            </p>
          )}
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">이번 주</p>
            <div className="p-1.5 md:p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
              <span className="material-symbols-outlined text-[18px] md:text-[22px]">date_range</span>
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold">{stats?.thisWeekNewUsers ?? '-'}</h3>
          {stats && (
            <p className={`text-[10px] md:text-xs mt-1 ${formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
              전주 대비 {formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).sign}{formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).percent}%
            </p>
          )}
        </div>

        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl p-3 md:p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-medium">활성 사용자</p>
            <div className="p-1.5 md:p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <span className="material-symbols-outlined text-[18px] md:text-[22px]">bolt</span>
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-bold">{stats?.activeUsers.toLocaleString() ?? '-'}</h3>
          {stats && stats.totalUsers > 0 && (
            <p className="text-[10px] md:text-xs text-slate-500 mt-1">
              {((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 md:pl-3 pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 text-[16px] md:text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 md:pl-10 pr-3 md:pr-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="이름 또는 이메일 검색..."
                />
              </div>
            </form>
            <LimitSelector defaultLimit={defaultLimit} isAll={isAllMode} onToggle={handleToggleAll} />
            <select
              value={currentStatus}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">전체 상태</option>
              <option value="ACTIVE">활성</option>
              <option value="SUSPENDED">정지</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12 md:py-20">
            <span className="material-symbols-outlined animate-spin text-3xl md:text-4xl text-primary">progress_activity</span>
          </div>
        ) : users.length > 0 ? (
          <>
            {/* Mobile: Card List */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((user) => (
                <div key={user.id} className="p-3">
                  <div className="flex items-start gap-3">
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400 font-bold text-xs">
                        {getInitials(user.name)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{user.name}</span>
                        {user.role === 'ADMIN' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">관리자</span>
                        )}
                        {user.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <span className="size-1 rounded-full bg-green-500" /> 활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            <span className="size-1 rounded-full bg-red-500" /> 정지됨
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{user.email}</div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span>가입일: {formatDate(user.createdAt)}</span>
                        <span>댓글: {user.commentCount}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => setProfileModal({ isOpen: true, user })} className="p-1.5 text-slate-400 hover:text-primary" title="프로필 보기">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                        </button>
                        {user.role !== 'ADMIN' && (
                          <>
                            {user.status === 'ACTIVE' ? (
                              <button onClick={() => setStatusModal({ isOpen: true, user, newStatus: 'SUSPENDED' })} className="p-1.5 text-slate-400 hover:text-orange-500" title="정지">
                                <span className="material-symbols-outlined text-[18px]">block</span>
                              </button>
                            ) : (
                              <button onClick={() => setStatusModal({ isOpen: true, user, newStatus: 'ACTIVE' })} className="p-1.5 text-primary hover:text-primary/80" title="해제">
                                <span className="material-symbols-outlined text-[18px]">settings_backup_restore</span>
                              </button>
                            )}
                            <button onClick={() => setDeleteModal({ isOpen: true, user })} className="p-1.5 text-slate-400 hover:text-red-500" title="삭제">
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">사용자</th>
                    <th className="px-6 py-4">이메일</th>
                    <th className="px-6 py-4 w-24 text-center">댓글</th>
                    <th className="px-6 py-4 w-32">가입일</th>
                    <th className="px-6 py-4 w-28">상태</th>
                    <th className="px-6 py-4 w-32 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400 font-bold text-xs">
                              {getInitials(user.name)}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{user.name}</span>
                            {user.role === 'ADMIN' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">관리자</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{user.email}</td>
                      <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">{user.commentCount}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4">
                        {user.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <span className="size-1.5 rounded-full bg-green-500" /> 활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            <span className="size-1.5 rounded-full bg-red-500" /> 정지됨
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setProfileModal({ isOpen: true, user })} className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="프로필 보기">
                            <span className="material-symbols-outlined text-[20px]">person</span>
                          </button>
                          {user.role !== 'ADMIN' && (
                            <>
                              {user.status === 'ACTIVE' ? (
                                <button onClick={() => setStatusModal({ isOpen: true, user, newStatus: 'SUSPENDED' })} className="p-2 text-slate-400 hover:text-orange-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="정지">
                                  <span className="material-symbols-outlined text-[20px]">block</span>
                                </button>
                              ) : (
                                <button onClick={() => setStatusModal({ isOpen: true, user, newStatus: 'ACTIVE' })} className="p-2 text-primary hover:text-primary/80 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="해제">
                                  <span className="material-symbols-outlined text-[20px]">settings_backup_restore</span>
                                </button>
                              )}
                              <button onClick={() => setDeleteModal({ isOpen: true, user })} className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="삭제">
                                <span className="material-symbols-outlined text-[20px]">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-12 md:py-20 text-slate-500">
            <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">group</span>
            <p className="text-sm md:text-base">사용자가 없습니다.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-3">
            <p className="text-xs text-slate-500">
              전체 {total.toLocaleString()}명 중 {((currentPage - 1) * 5) + 1}-{Math.min(currentPage * 5, total)}
            </p>
            <div className="flex items-center gap-1 md:gap-2">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px] md:text-[20px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number
                if (totalPages <= 5) page = i + 1
                else if (currentPage <= 3) page = i + 1
                else if (currentPage >= totalPages - 2) page = totalPages - 4 + i
                else page = currentPage - 2 + i
                return (
                  <button key={page} onClick={() => handlePageChange(page)} className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${currentPage === page ? 'bg-primary text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    {page}
                  </button>
                )
              })}
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px] md:text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signup Trend Chart */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <span className="material-symbols-outlined text-[20px]">trending_up</span>
            </div>
            <h3 className="text-base md:text-lg font-bold">신규 가입 추이</h3>
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['daily', 'weekly', 'monthly'] as SignupTrendPeriod[]).map((period) => (
              <button
                key={period}
                onClick={() => setTrendPeriod(period)}
                className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-colors ${trendPeriod === period ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-primary'}`}
              >
                {getPeriodLabel(period)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6">
          {trendData ? (
            <>
              {/* Bar Chart */}
              <div className="flex items-end justify-between gap-1 h-32 md:h-40 mb-4">
                {trendData.trend.map((item, index) => {
                  const maxCount = Math.max(...trendData.trend.map(d => d.count), 1)
                  const heightPercent = (item.count / maxCount) * 100
                  const opacity = 0.3 + (index / (trendData.trend.length - 1)) * 0.7
                  const isLast = index === trendData.trend.length - 1

                  return (
                    <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[9px] md:text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.count}
                      </span>
                      <div className="w-full flex items-end justify-center h-20 md:h-28">
                        <div
                          className="w-full max-w-[28px] md:max-w-[36px] rounded-t transition-all duration-300 group-hover:opacity-100 cursor-default"
                          style={{
                            height: `${Math.max(heightPercent, 4)}%`,
                            backgroundColor: `rgba(49, 130, 246, ${opacity})`,
                          }}
                          title={`${item.date}: ${item.count}명`}
                        />
                      </div>
                      <span className={`text-[9px] md:text-[10px] ${isLast ? 'text-primary font-bold' : 'text-slate-400'}`}>
                        {trendPeriod === 'daily' ? item.date.slice(5) : item.date}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm">
                <div className="text-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">{getSummaryLabel(trendPeriod).total}</span>
                  <p className="font-bold text-primary">{trendData.summary.total}명</p>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">{getSummaryLabel(trendPeriod).avg}</span>
                  <p className="font-bold">{trendData.summary.average}명</p>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">최고</span>
                  <p className="font-bold">{trendData.summary.max.count}명 <span className="text-xs text-slate-400">({trendData.summary.max.date})</span></p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex justify-center items-center py-12">
              <span className="material-symbols-outlined animate-spin text-2xl text-primary">progress_activity</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Pattern + Growth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Day of Week Pattern */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            </div>
            <h3 className="text-sm md:text-base font-bold">요일별 가입 패턴</h3>
          </div>

          {patternData ? (
            <>
              <div className="space-y-2">
                {patternData.pattern.map((item) => {
                  const maxAvg = Math.max(...patternData.pattern.map(p => p.average), 1)
                  const widthPercent = (item.average / maxAvg) * 100
                  const isPeak = item.day === patternData.peakDay

                  return (
                    <div key={item.day} className="flex items-center gap-2">
                      <span className={`w-6 text-xs font-medium ${isPeak ? 'text-primary' : 'text-slate-500'}`}>{item.day}</span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all ${isPeak ? 'bg-primary' : 'bg-primary/40'}`}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </div>
                      <span className={`text-xs w-12 text-right ${isPeak ? 'text-primary font-bold' : 'text-slate-500'}`}>
                        {item.average}명
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-orange-500">local_fire_department</span>
                <span className="text-primary font-bold">{patternData.peakDay}요일</span> 가입률이 가장 높습니다
              </p>
            </>
          ) : (
            <div className="flex justify-center items-center py-8">
              <span className="material-symbols-outlined animate-spin text-xl text-primary">progress_activity</span>
            </div>
          )}
        </div>

        {/* Growth Metrics */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <span className="material-symbols-outlined text-[18px]">insights</span>
            </div>
            <h3 className="text-sm md:text-base font-bold">성장 지표</h3>
          </div>

          {stats ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">전일 대비</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).sign}{formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).diff}명
                  </span>
                  <span className={`text-xs ml-2 ${formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    ({formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).sign}{formatChange(stats.todayNewUsers, stats.yesterdayNewUsers).percent}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">전주 대비</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).sign}{stats.thisWeekNewUsers - stats.lastWeekNewUsers}명
                  </span>
                  <span className={`text-xs ml-2 ${formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    ({formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).sign}{formatChange(stats.thisWeekNewUsers, stats.lastWeekNewUsers).percent}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-sm text-slate-600 dark:text-slate-400">전월 대비</span>
                <div className="text-right">
                  <span className={`text-sm font-bold ${formatChange(stats.thisMonthNewUsers, stats.lastMonthNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    {formatChange(stats.thisMonthNewUsers, stats.lastMonthNewUsers).sign}{stats.thisMonthNewUsers - stats.lastMonthNewUsers}명
                  </span>
                  <span className={`text-xs ml-2 ${formatChange(stats.thisMonthNewUsers, stats.lastMonthNewUsers).isPositive ? 'text-green-600' : 'text-red-500'}`}>
                    ({formatChange(stats.thisMonthNewUsers, stats.lastMonthNewUsers).sign}{formatChange(stats.thisMonthNewUsers, stats.lastMonthNewUsers).percent}%)
                  </span>
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">이번 달 신규</span>
                  <span className="font-bold">{stats.thisMonthNewUsers}명</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">지난 달 신규</span>
                  <span className="font-bold">{stats.lastMonthNewUsers}명</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center py-8">
              <span className="material-symbols-outlined animate-spin text-xl text-primary">progress_activity</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Change Modal */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setStatusModal({ isOpen: false, user: null, newStatus: null })} />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className={`p-1.5 md:p-2 rounded-lg ${statusModal.newStatus === 'SUSPENDED' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' : 'bg-green-100 dark:bg-green-900/30 text-green-600'}`}>
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">
                  {statusModal.newStatus === 'SUSPENDED' ? 'block' : 'settings_backup_restore'}
                </span>
              </div>
              <h3 className="text-base md:text-lg font-bold">{statusModal.newStatus === 'SUSPENDED' ? '사용자 정지' : '정지 해제'}</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              <strong className="text-slate-900 dark:text-white">"{statusModal.user?.name}"</strong>님을 {statusModal.newStatus === 'SUSPENDED' ? '정지' : '활성화'}하시겠습니까?
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button onClick={() => setStatusModal({ isOpen: false, user: null, newStatus: null })} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors">
                취소
              </button>
              <button onClick={handleStatusChange} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-white text-xs md:text-sm font-bold transition-colors ${statusModal.newStatus === 'SUSPENDED' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}>
                {statusModal.newStatus === 'SUSPENDED' ? '정지' : '활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, user: null })} />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">사용자 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              <strong className="text-slate-900 dark:text-white">"{deleteModal.user?.name}"</strong>님을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 해당 사용자의 모든 댓글도 함께 삭제됩니다.
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button onClick={() => setDeleteModal({ isOpen: false, user: null })} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors">
                취소
              </button>
              <button onClick={handleDelete} className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold transition-colors">
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileModal.isOpen && profileModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setProfileModal({ isOpen: false, user: null })} />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-5">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">person</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">사용자 프로필</h3>
            </div>

            <div className="flex items-center gap-4 mb-4 md:mb-5">
              {profileModal.user.avatar ? (
                <img src={profileModal.user.avatar} alt="" className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-600 dark:text-slate-400 font-bold text-lg md:text-xl">
                  {getInitials(profileModal.user.name)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white">{profileModal.user.name}</h4>
                  {profileModal.user.role === 'ADMIN' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">관리자</span>
                  )}
                </div>
                <p className="text-slate-500 text-sm">{profileModal.user.email}</p>
              </div>
            </div>

            <div className="space-y-3 mb-4 md:mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">소개</label>
                <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  {profileModal.user.bio || <span className="text-slate-400 italic">소개가 없습니다.</span>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">가입일</label>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{formatDate(profileModal.user.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">댓글 수</label>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{profileModal.user.commentCount}개</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={() => setProfileModal({ isOpen: false, user: null })} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
