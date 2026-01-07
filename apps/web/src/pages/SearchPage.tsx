import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api, { Post } from '../services/api'
import Sidebar from '../components/Sidebar'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const fetchSearchResults = async () => {
      setIsLoading(true)
      try {
        const pageParam = searchParams.get('page')
        const page = pageParam ? parseInt(pageParam, 10) : 1
        setCurrentPage(page)

        const { posts: results, meta } = await api.getPosts({
          search: query || undefined,
          page,
          limit: 10,
        })
        setPosts(results)
        setTotalCount(meta.total)
        setTotalPages(meta.totalPages)
      } catch (error) {
        console.error('Search failed:', error)
        setPosts([])
        setTotalCount(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSearchResults()
  }, [query, searchParams])

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const searchQuery = formData.get('search') as string
    setSearchParams({ q: searchQuery })
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    setSearchParams(params)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatViewCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          {/* Search Header */}
          <div className="flex flex-col gap-6">
            {/* Search Input */}
            <form onSubmit={handleSearch}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">
                    search
                  </span>
                </div>
                <input
                  name="search"
                  defaultValue={query}
                  className="block w-full py-3 pl-12 pr-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-lg"
                  placeholder="제목, 카테고리, 태그로 검색..."
                  type="text"
                />
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {query ? (
                    <>
                      <span className="text-primary">"{query}"</span> 검색 결과
                    </>
                  ) : (
                    '전체 게시물'
                  )}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                  총 {totalCount}개의 게시물을 찾았습니다.
                </p>
              </div>
            </div>
          </div>

          {/* Search Results */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4 block">
                search_off
              </span>
              <h3 className="text-lg font-bold mb-2">검색 결과가 없습니다</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                다른 검색어로 다시 시도해보세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="group flex flex-col md:flex-row gap-6 items-start pb-6 border-b border-slate-200 dark:border-slate-800 last:border-0"
                >
                  <Link
                    to={`/posts/${post.slug}`}
                    className="w-full md:w-48 aspect-video md:aspect-[4/3] rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800/50 group-hover:border-primary/20 transition-colors"
                  >
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-slate-400">
                          {post.category?.icon || 'article'}
                        </span>
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col h-full">
                    <div className="flex items-center gap-3 text-xs mb-2">
                      <span className="font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {post.category?.name || 'Uncategorized'}
                      </span>
                      <span className="text-slate-400">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3">
                      {post.excerpt}
                    </p>
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400"
                          >
                            #{tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-auto">
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        {formatViewCount(post.viewCount)}
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                        {post.readingTime} min
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pt-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              {totalPages > 5 && currentPage < totalPages - 2 && (
                <>
                  <span className="text-slate-400 px-2">...</span>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  )
}
