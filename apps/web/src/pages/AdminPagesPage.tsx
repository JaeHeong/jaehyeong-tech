import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { type Page, type PageStats } from '../services/api'
import TipTapEditor from '../components/TipTapEditor'
import { useModal } from '../contexts/ModalContext'

type PageTab = 'NOTICE' | 'STATIC'

export default function AdminPagesPage() {
  const { alert } = useModal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pages, setPages] = useState<Page[]>([])
  const [stats, setStats] = useState<PageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; page: Page | null }>({
    isOpen: false,
    page: null,
  })
  const [editModal, setEditModal] = useState<{ isOpen: boolean; page: Page | null; isNew: boolean }>({
    isOpen: false,
    page: null,
    isNew: false,
  })
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    badge: '',
    badgeColor: '',
    isPinned: false,
    status: 'DRAFT' as 'DRAFT' | 'PUBLISHED',
  })

  const activeTab = (searchParams.get('tab') as PageTab) || 'NOTICE'
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const currentStatus = searchParams.get('status') || ''

  useEffect(() => {
    fetchData()
  }, [activeTab, currentPage, currentStatus, searchQuery])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const [statsRes, pagesRes] = await Promise.all([
        api.getPageStats(),
        api.getAdminPages({
          page: currentPage,
          limit: 9,
          type: activeTab,
          status: currentStatus as 'DRAFT' | 'PUBLISHED' | undefined,
        }),
      ])
      setStats(statsRes)
      setPages(pagesRes.pages)
      setTotalPages(pagesRes.meta.totalPages)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTabChange = (tab: PageTab) => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    setSearchParams(params)
  }

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
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
    // Search functionality can be added later
  }

  const handleDelete = async () => {
    if (!deleteModal.page) return

    try {
      await api.deletePage(deleteModal.page.id)
      setPages(pages.filter((p) => p.id !== deleteModal.page?.id))
      setDeleteModal({ isOpen: false, page: null })
      fetchData() // Refresh stats
    } catch (error) {
      console.error('Failed to delete page:', error)
      await alert({ message: '페이지 삭제에 실패했습니다.', type: 'error' })
    }
  }

  const openEditModal = (page?: Page) => {
    if (page) {
      setFormData({
        title: page.title,
        content: page.content,
        excerpt: page.excerpt || '',
        badge: page.badge || '',
        badgeColor: page.badgeColor || '',
        isPinned: page.isPinned,
        status: page.status,
      })
      setEditModal({ isOpen: true, page, isNew: false })
    } else {
      setFormData({
        title: '',
        content: '',
        excerpt: '',
        badge: activeTab === 'NOTICE' ? '안내' : '',
        badgeColor: '',
        isPinned: false,
        status: 'DRAFT',
      })
      setEditModal({ isOpen: true, page: null, isNew: true })
    }
  }

  const handleSave = async () => {
    try {
      if (editModal.isNew) {
        await api.createPage({
          ...formData,
          type: activeTab,
        })
      } else if (editModal.page) {
        await api.updatePage(editModal.page.id, formData)
      }
      setEditModal({ isOpen: false, page: null, isNew: false })
      fetchData()
    } catch (error) {
      console.error('Failed to save page:', error)
      await alert({ message: '저장에 실패했습니다.', type: 'error' })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const getBadgeStyle = (badge?: string, badgeColor?: string) => {
    if (badgeColor === 'primary' || badge === '필독') {
      return 'bg-primary text-white'
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">페이지 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5 md:mt-1">
            공지사항과 정적 페이지를 관리합니다.
          </p>
        </div>
        {activeTab === 'NOTICE' && (
          <button
            onClick={() => openEditModal()}
            className="inline-flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs md:text-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
            새 공지사항
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined text-[18px] md:text-[24px]">description</span>
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold">{stats.total}</p>
                <p className="text-[10px] md:text-xs text-slate-500">전체</p>
              </div>
            </div>
          </div>
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg text-green-600">
                <span className="material-symbols-outlined text-[18px] md:text-[24px]">check_circle</span>
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold">{stats.published}</p>
                <p className="text-[10px] md:text-xs text-slate-500">공개됨</p>
              </div>
            </div>
          </div>
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-yellow-600">
                <span className="material-symbols-outlined text-[18px] md:text-[24px]">edit_note</span>
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold">{stats.drafts}</p>
                <p className="text-[10px] md:text-xs text-slate-500">임시저장</p>
              </div>
            </div>
          </div>
          <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600">
                <span className="material-symbols-outlined text-[18px] md:text-[24px]">campaign</span>
              </div>
              <div>
                <p className="text-lg md:text-2xl font-bold">{stats.notices}</p>
                <p className="text-[10px] md:text-xs text-slate-500">공지사항</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="flex">
            <button
              onClick={() => handleTabChange('NOTICE')}
              className={`px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'NOTICE'
                  ? 'text-primary border-primary'
                  : 'text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1 md:gap-2">
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">campaign</span>
                공지사항
              </span>
            </button>
            <button
              onClick={() => handleTabChange('STATIC')}
              className={`px-3 md:px-6 py-2.5 md:py-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'STATIC'
                  ? 'text-primary border-primary'
                  : 'text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1 md:gap-2">
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">article</span>
                정적 페이지
              </span>
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 text-[16px] md:text-[18px]">search</span>
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="제목으로 검색..."
                />
              </div>
            </form>

            <select
              value={currentStatus}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">전체 상태</option>
              <option value="PUBLISHED">공개됨</option>
              <option value="DRAFT">임시저장</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12 md:py-20">
            <span className="material-symbols-outlined animate-spin text-2xl md:text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : pages.length > 0 ? (
          <>
            {/* Mobile: Card List */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {pages.map((page) => (
                <div key={page.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {page.isPinned && (
                          <span className="material-symbols-outlined text-primary text-[14px]">push_pin</span>
                        )}
                        <span className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                          {page.title}
                        </span>
                      </div>
                      {page.excerpt && (
                        <p className="text-[10px] text-slate-500 line-clamp-1">{page.excerpt}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {page.status === 'PUBLISHED' && (
                        <Link
                          to={activeTab === 'NOTICE' ? `/notices/${page.slug}` : `/${page.slug}`}
                          target="_blank"
                          className="p-1.5 text-slate-400 hover:text-primary transition-colors rounded-lg"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </Link>
                      )}
                      {activeTab === 'STATIC' ? (
                        <Link
                          to={`/admin/pages/${page.id}/edit`}
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </Link>
                      ) : (
                        <button
                          onClick={() => openEditModal(page)}
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-lg"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                      <button
                        onClick={() => setDeleteModal({ isOpen: true, page })}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeTab === 'NOTICE' && page.badge && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${getBadgeStyle(page.badge, page.badgeColor)}`}>
                        {page.badge}
                      </span>
                    )}
                    {page.status === 'PUBLISHED' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <span className="size-1 rounded-full bg-green-500" />
                        공개됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        <span className="size-1 rounded-full bg-yellow-500" />
                        임시저장
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-500">조회 {page.viewCount.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-500">{formatDate(page.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                  <tr>
                    <th className="px-6 py-4">제목</th>
                    {activeTab === 'NOTICE' && <th className="px-6 py-4 w-24">뱃지</th>}
                    <th className="px-6 py-4 w-28">상태</th>
                    <th className="px-6 py-4 w-24 text-center">조회수</th>
                    <th className="px-6 py-4 w-32">수정일</th>
                    <th className="px-6 py-4 w-32 text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pages.map((page) => (
                    <tr
                      key={page.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {page.isPinned && (
                                <span className="material-symbols-outlined text-primary text-[16px]">push_pin</span>
                              )}
                              <span className="font-bold text-slate-900 dark:text-white line-clamp-1">
                                {page.title}
                              </span>
                            </div>
                            {page.excerpt && (
                              <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                {page.excerpt}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      {activeTab === 'NOTICE' && (
                        <td className="px-6 py-4">
                          {page.badge && (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeStyle(page.badge, page.badgeColor)}`}>
                              {page.badge}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        {page.status === 'PUBLISHED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <span className="size-1.5 rounded-full bg-green-500" />
                            공개됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            <span className="size-1.5 rounded-full bg-yellow-500" />
                            임시저장
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        {page.viewCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(page.updatedAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {page.status === 'PUBLISHED' && (
                            <Link
                              to={activeTab === 'NOTICE' ? `/notices/${page.slug}` : `/${page.slug}`}
                              target="_blank"
                              className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="미리보기"
                            >
                              <span className="material-symbols-outlined text-[20px]">visibility</span>
                            </Link>
                          )}
                          {activeTab === 'STATIC' ? (
                            <Link
                              to={`/admin/pages/${page.id}/edit`}
                              className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="수정"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </Link>
                          ) : (
                            <button
                              onClick={() => openEditModal(page)}
                              className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="수정"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, page })}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="삭제"
                          >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
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
            <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">
              {activeTab === 'NOTICE' ? 'campaign' : 'article'}
            </span>
            <p className="text-sm md:text-base">{activeTab === 'NOTICE' ? '공지사항이 없습니다.' : '정적 페이지가 없습니다.'}</p>
            {activeTab === 'NOTICE' ? (
              <button
                onClick={() => openEditModal()}
                className="mt-3 md:mt-4 text-primary hover:underline text-xs md:text-sm font-medium"
              >
                + 새 공지사항 추가
              </button>
            ) : (
              <p className="mt-3 md:mt-4 text-xs md:text-sm text-slate-400">
                정적 페이지는 코드로 추가해야 합니다.
              </p>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-3 md:px-6 py-3 md:py-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
            <div className="flex items-center gap-1 md:gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] md:text-[20px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number
                if (totalPages <= 5) {
                  page = i + 1
                } else if (currentPage <= 3) {
                  page = i + 1
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i
                } else {
                  page = currentPage - 2 + i
                }
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-primary text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] md:text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, page: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">페이지 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              <strong className="text-slate-900 dark:text-white">"{deleteModal.page?.title}"</strong>
              을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, page: null })}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setEditModal({ isOpen: false, page: null, isNew: false })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-5xl w-full border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-base md:text-lg font-bold">
                {editModal.isNew
                  ? (activeTab === 'NOTICE' ? '새 공지사항' : '새 페이지')
                  : (activeTab === 'NOTICE' ? '공지사항 수정' : '페이지 수정')}
              </h3>
              <button
                onClick={() => setEditModal({ isOpen: false, page: null, isNew: false })}
                className="p-1.5 md:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">close</span>
              </button>
            </div>

            <div className="space-y-3 md:space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="제목을 입력하세요"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  요약
                </label>
                <input
                  type="text"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  className="w-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  placeholder="목록에 표시될 요약을 입력하세요"
                />
              </div>

              {/* Content - TipTap Editor */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  내용 *
                </label>
                <TipTapEditor
                  content={formData.content}
                  onChange={(content) => setFormData({ ...formData, content })}
                  placeholder="내용을 작성하세요..."
                />
              </div>

              {/* Badge (for notices only) */}
              {activeTab === 'NOTICE' && (
                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      뱃지
                    </label>
                    <select
                      value={formData.badge}
                      onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">선택 안함</option>
                      <option value="필독">필독</option>
                      <option value="안내">안내</option>
                      <option value="업데이트">업데이트</option>
                      <option value="이벤트">이벤트</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      뱃지 색상
                    </label>
                    <select
                      value={formData.badgeColor}
                      onChange={(e) => setFormData({ ...formData, badgeColor: e.target.value })}
                      className="w-full px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">기본</option>
                      <option value="primary">강조 (파랑)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="flex flex-wrap items-center gap-4 md:gap-6">
                {activeTab === 'NOTICE' && (
                  <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPinned}
                      onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                      className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                    />
                    <span className="text-xs md:text-sm text-slate-700 dark:text-slate-300">상단 고정</span>
                  </label>
                )}
                <label className="flex items-center gap-1.5 md:gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.status === 'PUBLISHED'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'PUBLISHED' : 'DRAFT' })}
                    className="w-3.5 h-3.5 md:w-4 md:h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                  <span className="text-xs md:text-sm text-slate-700 dark:text-slate-300">바로 공개</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 md:gap-3 justify-end mt-4 md:mt-6 pt-3 md:pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setEditModal({ isOpen: false, page: null, isNew: false })}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.title || !formData.content}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs md:text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editModal.isNew ? '생성' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
