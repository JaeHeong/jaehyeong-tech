import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { Post, Category } from '../services/api'

export default function AdminPostsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; post: Post | null }>({
    isOpen: false,
    post: null,
  })

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
            limit: 20,
            category: currentCategory || undefined,
            status: currentStatus as 'DRAFT' | 'PUBLISHED' | undefined,
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold">게시물 관리</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            전체 게시글을 관리합니다.
          </p>
        </div>
        <Link
          to="/admin/posts/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          새 글 작성
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 text-[18px]">search</span>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                placeholder="제목으로 검색..."
              />
            </div>
          </form>

          {/* Category Filter */}
          <select
            value={currentCategory}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
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
            className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="">전체 상태</option>
            <option value="PUBLISHED">공개됨</option>
            <option value="DRAFT">임시저장</option>
          </select>
        </div>
      </div>

      {/* Posts Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">
              progress_activity
            </span>
          </div>
        ) : posts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">제목</th>
                  <th className="px-6 py-4 w-32">카테고리</th>
                  <th className="px-6 py-4 w-28">상태</th>
                  <th className="px-6 py-4 w-24 text-center">조회수</th>
                  <th className="px-6 py-4 w-32">작성일</th>
                  <th className="px-6 py-4 w-32 text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {post.coverImage ? (
                          <img
                            src={post.coverImage}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-slate-400">article</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                            {post.title}
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
                      {post.status === 'PUBLISHED' ? (
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
                      {post.viewCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{formatDate(post.createdAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/posts/${post.slug}`}
                          target="_blank"
                          className="p-2 text-slate-400 hover:text-primary transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="미리보기"
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </Link>
                        <Link
                          to={`/admin/posts/${post.id}/edit`}
                          className="p-2 text-slate-400 hover:text-blue-500 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="수정"
                        >
                          <span className="material-symbols-outlined text-[20px]">edit</span>
                        </Link>
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, post })}
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
        ) : (
          <div className="text-center py-20 text-slate-500">
            <span className="material-symbols-outlined text-[48px] mb-4 block">article</span>
            <p>게시글이 없습니다.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
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
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
                className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, post: null })}
          />
          <div className="relative bg-card-light dark:bg-card-dark rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600">
                <span className="material-symbols-outlined">warning</span>
              </div>
              <h3 className="text-lg font-bold">게시글 삭제</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              <strong className="text-slate-900 dark:text-white">"{deleteModal.post?.title}"</strong>
              을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteModal({ isOpen: false, post: null })}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
