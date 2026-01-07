import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api, { Post, Category } from '../services/api'
import Sidebar from '../components/Sidebar'

export default function PostListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [posts, setPosts] = useState<Post[]>([])
  const [featuredPost, setFeaturedPost] = useState<Post | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)

  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const currentCategory = searchParams.get('category') || ''

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch categories
        const catRes = await api.getCategories()
        setCategories(catRes.categories)

        // Fetch top viewed post (overall or by category)
        const topViewedRes = await api.getTopViewedPost(currentCategory || undefined)
        setFeaturedPost(topViewedRes.data)

        // Fetch posts
        const postsRes = await api.getPosts({
          page: currentPage,
          limit: 10,
          category: currentCategory || undefined,
        })
        setPosts(postsRes.posts)
        setTotalPages(postsRes.meta.totalPages)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [currentPage, currentCategory])

  const handleCategoryChange = (categorySlug: string) => {
    const params = new URLSearchParams()
    if (categorySlug) {
      params.set('category', categorySlug)
    }
    setSearchParams(params)
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
          {/* Header */}
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <h1 className="text-3xl font-bold tracking-tight">글 목록</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              DevOps, MLOps, 클라우드 인프라에 대한 기술 글을 공유합니다.
            </p>
          </div>

          {/* Featured Post */}
          {featuredPost && !currentCategory && currentPage === 1 && (
            <Link
              to={`/posts/${featuredPost.slug}`}
              className="group relative overflow-hidden rounded-xl card hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-col md:flex-row">
                <div className="md:w-2/5 h-48 md:h-auto relative overflow-hidden">
                  {featuredPost.coverImage ? (
                    <img
                      src={featuredPost.coverImage}
                      alt={featuredPost.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                      <span className="material-symbols-outlined text-5xl text-slate-400">
                        {featuredPost.category?.icon || 'article'}
                      </span>
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-primary text-white text-xs font-bold rounded-full shadow">
                    Featured
                  </span>
                </div>
                <div className="md:w-3/5 p-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                    <span className="font-bold text-primary">{featuredPost.category?.name}</span>
                    <span>•</span>
                    <span>{formatDate(featuredPost.publishedAt || featuredPost.createdAt)}</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {featuredPost.title}
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-4">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                      {formatViewCount(featuredPost.viewCount)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      {featuredPost.readingTime} min
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Category Filter */}
          <div className="sticky top-16 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm py-4 -mx-2 px-2 border-b border-transparent">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => handleCategoryChange('')}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !currentCategory
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-slate-200 dark:bg-secondary-dark text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                전체
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    currentCategory === cat.slug
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-slate-200 dark:bg-secondary-dark text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Posts List */}
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : posts.length > 0 ? (
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
          ) : (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-[48px] mb-4 block">article</span>
              <p>아직 게시글이 없습니다.</p>
              <p className="text-sm">첫 번째 글을 작성해보세요!</p>
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
