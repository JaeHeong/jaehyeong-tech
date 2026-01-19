import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom'
import api, { Post, Category } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from '../components/Sidebar'
import MobileProfileModal from '../components/MobileProfileModal'
import { useSEO } from '../hooks/useSEO'

export default function PostListPage() {
  const { user } = useAuth()
  const { slug: pathSlug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [featuredPost, setFeaturedPost] = useState<Post | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

  // SEO - 카테고리에 따른 동적 설정
  const currentCategorySlug = pathSlug || searchParams.get('category') || ''
  const categoryInfo = categories.find(c => c.slug === currentCategorySlug)

  useSEO({
    title: currentCategorySlug
      ? `${categoryInfo?.name || currentCategorySlug} 글 목록`
      : '글 목록',
    description: currentCategorySlug
      ? categoryInfo?.description || `${categoryInfo?.name || currentCategorySlug} 관련 기술 글 모음`
      : 'DevOps, MLOps, 클라우드 인프라에 대한 기술 글을 공유합니다.',
    url: currentCategorySlug ? `/categories/${currentCategorySlug}` : '/posts',
    type: 'website',
  })

  // Refs for category buttons to enable auto-scroll
  const categoryButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  // Use path slug (/categories/:slug) or query param (?category=)
  const currentCategory = pathSlug || searchParams.get('category') || ''

  // Scroll to selected category button
  const scrollToSelectedCategory = useCallback(() => {
    const key = currentCategory || 'all'
    const button = categoryButtonRefs.current.get(key)
    if (button) {
      button.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [currentCategory])

  // Scroll to selected category when categories are loaded or category changes
  useEffect(() => {
    if (categories.length > 0) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(scrollToSelectedCategory, 100)
      return () => clearTimeout(timer)
    }
  }, [categories, currentCategory, scrollToSelectedCategory])

  useEffect(() => {
    window.scrollTo(0, 0)

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
  }, [currentPage, currentCategory, pathSlug])

  const handleCategoryChange = (categorySlug: string) => {
    // If we're on /categories/:slug path, navigate to appropriate URL
    if (pathSlug !== undefined) {
      if (categorySlug) {
        navigate(`/categories/${categorySlug}`)
      } else {
        navigate('/posts')
      }
    } else {
      // If we're on /posts with query params
      const params = new URLSearchParams()
      if (categorySlug) {
        params.set('category', categorySlug)
      }
      setSearchParams(params)
    }
  }

  const handlePageChange = (page: number) => {
    if (pathSlug !== undefined) {
      // For path-based routing, use query params for pagination
      navigate(`/categories/${pathSlug}?page=${page}`)
    } else {
      const params = new URLSearchParams(searchParams)
      params.set('page', page.toString())
      setSearchParams(params)
    }
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-4 md:gap-8">
          {/* Header */}
          <div className="flex flex-col gap-1 md:gap-2 pb-3 md:pb-4 border-b border-slate-200 dark:border-slate-800">
            {currentCategory ? (
              <>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {categories.find(c => c.slug === currentCategory)?.name || currentCategory}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg">
                  {categories.find(c => c.slug === currentCategory)?.description || '카테고리별 글 목록입니다.'}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">글 목록</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg">
                  DevOps, MLOps, 클라우드 인프라에 대한 기술 글을 공유합니다.
                </p>
              </>
            )}
          </div>

          {/* Featured Post - shows for both global and per-category */}
          {featuredPost && currentPage === 1 && (
            <Link
              to={`/posts/${featuredPost.slug}`}
              className="group relative overflow-hidden rounded-xl card hover:shadow-lg transition-shadow"
            >
              <div className="flex flex-row">
                <div className="w-1/3 md:w-2/5 min-h-[120px] md:min-h-[200px] relative overflow-hidden">
                  {featuredPost.coverImage ? (
                    <img
                      src={featuredPost.coverImage}
                      alt={featuredPost.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl md:text-5xl text-slate-400">
                        {featuredPost.category?.icon || 'article'}
                      </span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-bold shadow flex items-center gap-1 animate-pulse" style={{ backgroundColor: '#fdecf5', color: '#db2777' }}>
                    <span className="material-symbols-outlined text-[12px] md:text-[14px]">local_fire_department</span>
                    인기
                  </span>
                </div>
                <div className="w-2/3 md:w-3/5 p-3 md:p-6 flex flex-col justify-center">
                  <div className="flex items-center gap-1 md:gap-2 text-[10px] md:text-xs text-slate-500 mb-1 md:mb-3">
                    <span className="font-bold text-primary">{featuredPost.category?.name}</span>
                    {user?.role === 'ADMIN' && featuredPost.status === 'PRIVATE' && (
                      <span className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <span className="material-symbols-outlined text-[12px] md:text-[14px]">visibility_off</span>
                        <span className="text-[8px] md:text-[10px] font-medium">비공개</span>
                      </span>
                    )}
                    <span className="hidden md:inline">•</span>
                    <span className="hidden md:inline">{formatDate(featuredPost.publishedAt || featuredPost.createdAt)}</span>
                  </div>
                  <h2 className="text-base md:text-2xl font-bold mb-1 md:mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {featuredPost.title}
                  </h2>
                  <p className="hidden md:block text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-4">
                    {featuredPost.excerpt}
                  </p>
                  <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] md:text-[16px]">visibility</span>
                      {formatViewCount(featuredPost.viewCount)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] md:text-[16px]">schedule</span>
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
                ref={(el) => {
                  if (el) categoryButtonRefs.current.set('all', el)
                }}
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
                  ref={(el) => {
                    if (el) categoryButtonRefs.current.set(cat.slug, el)
                  }}
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
            <div className="flex flex-col gap-4 md:gap-6">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="group flex flex-row gap-3 md:gap-6 items-start pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800 last:border-0"
                >
                  <Link
                    to={`/posts/${post.slug}`}
                    className="w-28 md:w-48 aspect-[4/3] rounded-lg overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800/50 group-hover:border-primary/20 transition-colors"
                  >
                    {post.coverImage ? (
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl md:text-4xl text-slate-400">
                          {post.category?.icon || 'article'}
                        </span>
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col h-full">
                    <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs mb-1 md:mb-2">
                      <span className="font-bold px-1.5 md:px-2 py-0.5 rounded bg-primary/10 text-primary">
                        {post.category?.name || 'Uncategorized'}
                      </span>
                      {user?.role === 'ADMIN' && post.status === 'PRIVATE' && (
                        <span className="inline-flex items-center gap-0.5 md:gap-1 px-1 md:px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          <span className="material-symbols-outlined text-[12px] md:text-[14px]">visibility_off</span>
                          <span className="text-[8px] md:text-[10px] font-medium">비공개</span>
                        </span>
                      )}
                      <span className="text-slate-400">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </span>
                    </div>
                    <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 group-hover:text-primary transition-colors line-clamp-2 md:line-clamp-2">
                      <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <Link to={`/posts/${post.slug}`} className="hidden md:block text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3">
                      {post.excerpt}
                    </Link>
                    <div className="flex items-center gap-2 md:gap-4 mt-auto">
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] md:text-xs">
                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">visibility</span>
                        {formatViewCount(post.viewCount)}
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] md:text-xs">
                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">schedule</span>
                        {post.readingTime} min
                      </div>
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] md:text-xs">
                        <span className="material-symbols-outlined text-[14px] md:text-[16px]">favorite</span>
                        {post.likeCount}
                      </div>
                    </div>
                    {/* Tags */}
                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 md:gap-1.5 mt-2">
                        {(expandedTags.has(post.id) ? post.tags : post.tags.slice(0, 3)).map((tag) => (
                          <Link
                            key={tag.id}
                            to={`/search?tag=${encodeURIComponent(tag.slug)}`}
                            className="px-1.5 md:px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] md:text-xs text-slate-500 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            #{tag.name}
                          </Link>
                        ))}
                        {post.tags.length > 3 && !expandedTags.has(post.id) && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setExpandedTags(prev => new Set(prev).add(post.id))
                            }}
                            className="px-1.5 md:px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] md:text-xs text-slate-400 dark:text-slate-500 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                          >
                            +{post.tags.length - 3}
                          </button>
                        )}
                      </div>
                    )}
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
            <div className="flex justify-center items-center gap-1 pt-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              {(() => {
                // 모바일: 중간 1개, 데스크톱: 중간 3개
                const pagesDesktop: (number | 'ellipsis-left' | 'ellipsis-right')[] = []
                const pagesMobile: (number | 'ellipsis-left' | 'ellipsis-right')[] = []

                // 데스크톱 로직
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pagesDesktop.push(i)
                } else if (currentPage <= 4) {
                  for (let i = 1; i <= 5; i++) pagesDesktop.push(i)
                  pagesDesktop.push('ellipsis-right')
                  pagesDesktop.push(totalPages)
                } else if (currentPage >= totalPages - 3) {
                  pagesDesktop.push(1)
                  pagesDesktop.push('ellipsis-left')
                  for (let i = totalPages - 4; i <= totalPages; i++) pagesDesktop.push(i)
                } else {
                  pagesDesktop.push(1)
                  pagesDesktop.push('ellipsis-left')
                  for (let i = currentPage - 1; i <= currentPage + 1; i++) pagesDesktop.push(i)
                  pagesDesktop.push('ellipsis-right')
                  pagesDesktop.push(totalPages)
                }

                // 모바일 로직 (중간 1개)
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pagesMobile.push(i)
                } else if (currentPage <= 2) {
                  for (let i = 1; i <= 3; i++) pagesMobile.push(i)
                  pagesMobile.push('ellipsis-right')
                  pagesMobile.push(totalPages)
                } else if (currentPage >= totalPages - 1) {
                  pagesMobile.push(1)
                  pagesMobile.push('ellipsis-left')
                  for (let i = totalPages - 2; i <= totalPages; i++) pagesMobile.push(i)
                } else {
                  pagesMobile.push(1)
                  pagesMobile.push('ellipsis-left')
                  pagesMobile.push(currentPage)
                  pagesMobile.push('ellipsis-right')
                  pagesMobile.push(totalPages)
                }

                const renderPages = (pages: (number | 'ellipsis-left' | 'ellipsis-right')[], isMobile: boolean) =>
                  pages.map((page, idx) => {
                    if (page === 'ellipsis-left' || page === 'ellipsis-right') {
                      return <span key={`${isMobile ? 'm' : 'd'}-${page}`} className="text-slate-400 px-1 md:px-2">...</span>
                    }
                    return (
                      <button
                        key={`${isMobile ? 'm' : 'd'}-${idx}`}
                        onClick={() => handlePageChange(page)}
                        className={`px-2.5 md:px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })

                return (
                  <>
                    <div className="hidden md:flex items-center gap-1">{renderPages(pagesDesktop, false)}</div>
                    <div className="flex md:hidden items-center gap-1">{renderPages(pagesMobile, true)}</div>
                  </>
                )
              })()}
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

      {/* Mobile Profile Modal */}
      <MobileProfileModal />
    </div>
  )
}
