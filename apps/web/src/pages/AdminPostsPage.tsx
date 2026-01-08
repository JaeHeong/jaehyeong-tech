import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import api, { Post, Category } from '../services/api'

export default function AdminPostsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; post: Post | null }>({
    isOpen: false,
    post: null,
  })
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false)
  const [expandedTagsId, setExpandedTagsId] = useState<string | null>(null)
  const [tagModalPosition, setTagModalPosition] = useState<{ top: number; left: number } | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const currentCategory = searchParams.get('category') || ''
  const currentStatus = searchParams.get('status') || ''

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [catRes, postsRes] = await Promise.all([
          api.getCategories(),
          api.getPosts({
            page: currentPage,
            limit: 9,
            category: currentCategory || undefined,
            status: (currentStatus || 'PUBLISHED') as 'PUBLISHED' | 'PRIVATE' | 'ALL',
            search: searchQuery || undefined,
          }),
        ])
        setCategories(catRes.categories)
        setPosts(postsRes.posts)
        setTotalPages(postsRes.meta.totalPages)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentPage, currentCategory, currentStatus, searchQuery])

  // 페이지/필터 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds([])
    setExpandedTagsId(null)
  }, [currentPage, currentCategory, currentStatus])

  // 모바일에서 다른 곳 터치 시 태그 모달 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-tag-modal]') && !target.closest('[data-tag-trigger]')) {
        setExpandedTagsId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleSelectAll = () => {
    if (selectedIds.length === posts.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(posts.map((p) => p.id))
    }
  }

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    try {
      await api.bulkDeletePosts(selectedIds)
      setPosts(posts.filter((p) => !selectedIds.includes(p.id)))
      setSelectedIds([])
      setBulkDeleteModal(false)
    } catch (error) {
      console.error('Failed to bulk delete posts:', error)
      alert('게시글 삭제에 실패했습니다.')
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // Reset page when filter changes
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

  const handleDelete = async () => {
    if (!deleteModal.post) return

    try {
      await api.deletePost(deleteModal.post.id)
      setPosts(posts.filter((p) => p.id !== deleteModal.post?.id))
      setDeleteModal({ isOpen: false, post: null })
    } catch (error) {
      console.error('Failed to delete post:', error)
      alert('게시글 삭제에 실패했습니다.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">게시물 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5 md:mt-1">
            전체 게시글을 관리합니다.
          </p>
        </div>
        <Link
          to="/admin/posts/new"
          className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs md:text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[16px] md:text-[18px]">add</span>
          새 글 작성
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 md:p-4">
        <div className="flex flex-col md:flex-row gap-2 md:gap-4">
          {/* Search */}
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
                placeholder="제목으로 검색..."
              />
            </div>
          </form>

          {/* Filter Row */}
          <div className="flex gap-2">
            {/* Category Filter */}
            <select
              value={currentCategory}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="flex-1 md:flex-none px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="">전체 카테고리</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={currentStatus}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="flex-1 md:flex-none px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            >
              <option value="PUBLISHED">발행됨</option>
              <option value="PUBLIC">공개</option>
              <option value="PRIVATE">비공개</option>
            </select>
          </div>

          {/* Bulk Delete */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 md:ml-auto md:pl-4 md:border-l border-slate-200 dark:border-slate-700">
              <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                {selectedIds.length}개 선택됨
              </span>
              <button
                onClick={() => setBulkDeleteModal(true)}
                className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">delete</span>
                삭제
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-12 md:py-20">
            <span className="material-symbols-outlined animate-spin text-3xl md:text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : posts.length > 0 ? (
          <>
            {/* Mobile: Card List */}
            <div className="md:hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-400 dark:text-slate-500">
                제목을 터치하면 태그가 표시됩니다
              </div>
            </div>
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {posts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => handleSelectOne(post.id)}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedIds.includes(post.id)
                      ? 'bg-slate-50 dark:bg-slate-800/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 썸네일 */}
                    {post.coverImage ? (
                      <img src={post.coverImage} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-slate-400 text-[20px]">{post.category?.icon || 'article'}</span>
                      </div>
                    )}
                    {/* 콘텐츠 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="relative">
                          <button
                            data-tag-trigger
                            onClick={(e) => {
                              e.stopPropagation()
                              if (post.tags && post.tags.length > 0) {
                                setExpandedTagsId(expandedTagsId === post.id ? null : post.id)
                              }
                            }}
                            className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 text-left"
                          >
                            {post.title}
                            {post.tags && post.tags.length > 0 && (
                              <span className="ml-1 text-[10px] text-primary font-normal">
                                ({post.tags.length})
                              </span>
                            )}
                          </button>
                          {/* Tags Modal */}
                          {expandedTagsId === post.id && post.tags && post.tags.length > 0 && (
                            <div data-tag-modal className="absolute left-0 top-full mt-2 z-50 bg-card-light dark:bg-card-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-lg animate-fade-in min-w-[200px] max-w-[280px]">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500">
                                  <span className="material-symbols-outlined text-[16px]">sell</span>
                                </div>
                                <h4 className="text-sm font-bold">태그</h4>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {post.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-400"
                                  >
                                    #{tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* 상태 마크 (오른쪽) */}
                        {post.status === 'PUBLIC' ? (
                          <span className="shrink-0 size-2 rounded-full bg-green-500" />
                        ) : (
                          <span className="shrink-0 size-2 rounded-full bg-slate-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                        <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{post.category?.name}</span>
                        <span>조회 {post.viewCount.toLocaleString()}</span>
                        <span>좋아요 {post.likeCount.toLocaleString()}</span>
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <Link
                          to={`/posts/${post.slug}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-slate-400 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </Link>
                        <Link
                          to={`/admin/posts/${post.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-slate-400 hover:text-blue-500"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteModal({ isOpen: true, post })
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
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
                    <th className="px-6 py-4">
                      <span>제목</span>
                      <span className="ml-2 text-[10px] font-normal normal-case text-slate-400">
                        (마우스 올리면 태그 표시)
                      </span>
                    </th>
                    <th className="px-6 py-4 w-32">카테고리</th>
                    <th className="px-6 py-4 w-28">상태</th>
                    <th className="px-6 py-4 w-24 text-center">조회수</th>
                    <th className="px-6 py-4 w-24 text-center">좋아요</th>
                    <th className="px-6 py-4 w-32">작성일</th>
                    <th className="px-6 py-4 w-40">
                      <div className="flex items-center justify-between">
                        <span>관리</span>
                        <button
                          onClick={handleSelectAll}
                          className="text-[10px] font-medium text-primary hover:text-primary/80 normal-case"
                        >
                          {selectedIds.length === posts.length && posts.length > 0 ? '전체 해제' : '전체 선택'}
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      onClick={() => handleSelectOne(post.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedIds.includes(post.id)
                          ? 'bg-slate-50 dark:bg-slate-800/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {post.coverImage ? (
                            <img src={post.coverImage} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-slate-400">{post.category?.icon || 'article'}</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div
                              className="font-bold text-slate-900 dark:text-white line-clamp-1 cursor-default"
                              onMouseEnter={(e) => {
                                if (post.tags && post.tags.length > 0) {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  hoverTimeoutRef.current = setTimeout(() => {
                                    setExpandedTagsId(post.id)
                                    setTagModalPosition({ top: rect.bottom + 8, left: rect.left })
                                  }, 100)
                                }
                              }}
                              onMouseLeave={() => {
                                if (hoverTimeoutRef.current) {
                                  clearTimeout(hoverTimeoutRef.current)
                                }
                                setExpandedTagsId(null)
                                setTagModalPosition(null)
                              }}
                            >
                              {post.title}
                              {post.tags && post.tags.length > 0 && (
                                <span className="ml-1.5 text-xs text-primary font-normal">
                                  ({post.tags.length})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 line-clamp-1">
                              {post.excerpt}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {post.category?.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {post.status === 'PUBLIC' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            <span className="size-1.5 rounded-full bg-green-500" />
                            공개
                          </span>
                        ) : post.status === 'PRIVATE' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                            <span className="size-1.5 rounded-full bg-slate-500" />
                            비공개
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            <span className="size-1.5 rounded-full bg-yellow-500" />
                            임시저장
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">{post.viewCount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-slate-500">{post.likeCount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(post.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/posts/${post.slug}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="미리보기"
                          >
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </Link>
                          <Link
                            to={`/admin/posts/${post.id}/edit`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="수정"
                          >
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </Link>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteModal({ isOpen: true, post })
                            }}
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
            <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4 block">article</span>
            <p className="text-sm md:text-base">게시글이 없습니다.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
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
            onClick={() => setDeleteModal({ isOpen: false, post: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">게시글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              <strong className="text-slate-900 dark:text-white">"{deleteModal.post?.title}"</strong>
              을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, post: null })}
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

      {/* Bulk Delete Modal */}
      {bulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setBulkDeleteModal(false)}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl p-4 md:p-6 max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined text-[20px] md:text-[24px]">warning</span>
              </div>
              <h3 className="text-base md:text-lg font-bold">게시글 일괄 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 md:mb-6 text-sm md:text-base">
              선택한 <strong className="text-slate-900 dark:text-white">{selectedIds.length}개</strong>의 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-2 md:gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteModal(false)}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs md:text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs md:text-sm font-bold transition-colors"
              >
                {selectedIds.length}개 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal Portal - Desktop hover */}
      {expandedTagsId && tagModalPosition && createPortal(
        <div
          data-tag-modal
          className="fixed z-[100] bg-card-light dark:bg-card-dark rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xl min-w-[240px] max-w-[320px] animate-fade-in"
          style={{ top: tagModalPosition.top, left: tagModalPosition.left }}
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
            }
          }}
          onMouseLeave={() => {
            setExpandedTagsId(null)
            setTagModalPosition(null)
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500">
              <span className="material-symbols-outlined text-[16px]">sell</span>
            </div>
            <h4 className="text-sm font-bold">태그</h4>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {posts.find(p => p.id === expandedTagsId)?.tags?.map((tag) => (
              <span
                key={tag.id}
                className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
