import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { Post, Category } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from '../components/Sidebar'
import MobileProfileModal from '../components/MobileProfileModal'
import NoticeModal from '../components/NoticeModal'
import { useSEO } from '../hooks/useSEO'

export default function HomePage() {
  useSEO({
    title: undefined,
    description: 'DevOps, MLOps, 클라우드 인프라 기술 블로그. 최신 기술 트렌드와 실무 노하우를 공유합니다.',
    url: '/',
    type: 'website',
  })
  const { user } = useAuth()
  const [featuredPost, setFeaturedPost] = useState<Post | null>(null)
  const [latestPosts, setLatestPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch featured post
        const featuredRes = await api.getPosts({ featured: true, limit: 1 })
        if (featuredRes.posts.length > 0) {
          setFeaturedPost(featuredRes.posts[0] ?? null)
        }

        // Fetch latest posts
        const postsRes = await api.getPosts({ limit: 5 })
        setLatestPosts(postsRes.posts)

        // Fetch categories
        const catRes = await api.getCategories()
        setCategories(catRes.categories.slice(0, 4))
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const defaultCategories = [
    { name: 'DevOps', icon: 'settings_suggest', color: 'blue', description: 'CI/CD 파이프라인, 자동화, 그리고 인프라 관리에 대한 실무 가이드' },
    { name: 'MLOps', icon: 'psychology', color: 'purple', description: '모델 서빙, 모니터링, 데이터 파이프라인 구축을 위한 엔지니어링' },
    { name: 'Cloud Native', icon: 'cloud', color: 'orange', description: 'Kubernetes, Docker 및 클라우드 네이티브 아키텍처 패턴' },
    { name: 'AI & ML', icon: 'smart_toy', color: 'green', description: '최신 AI 트렌드, LLM 활용법 및 데이터 사이언스 인사이트' },
  ]

  const displayCategories = categories.length > 0 ? categories : defaultCategories

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Featured Post - Full Width */}
      <section className="mb-10 md:mb-16">
        {featuredPost ? (
          <Link
            to={`/posts/${featuredPost.slug}`}
            className="relative overflow-hidden rounded-xl md:rounded-2xl card shadow-sm hover:shadow-md transition-shadow group cursor-pointer block"
          >
            <div className="flex flex-row lg:grid lg:grid-cols-2 lg:gap-8 items-center">
              {/* Mobile: Image first (left), Desktop: Text first */}
              <div className="w-1/3 lg:w-auto lg:order-1 min-h-[120px] md:min-h-[200px] lg:min-h-[320px] lg:h-full relative overflow-hidden order-1 lg:order-2">
                {featuredPost.coverImage ? (
                  <div
                    className="w-full h-full min-h-[120px] md:min-h-[200px] lg:min-h-[320px] bg-cover bg-center"
                    style={{ backgroundImage: `url(${featuredPost.coverImage})` }}
                  />
                ) : (
                  <div className="w-full h-full min-h-[120px] md:min-h-[200px] lg:min-h-[320px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center relative overflow-hidden">
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
                        backgroundSize: '24px 24px',
                      }}
                    />
                    <div className="p-3 md:p-6 bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-[140px] md:max-w-xs w-full mx-4 md:mx-6 transform rotate-2 hover:rotate-0 transition-transform duration-500">
                      <div className="flex items-center gap-1 md:gap-2 mb-2 md:mb-3 border-b border-slate-100 dark:border-slate-700 pb-2 md:pb-3">
                        <div className="size-1.5 md:size-2.5 rounded-full bg-red-500" />
                        <div className="size-1.5 md:size-2.5 rounded-full bg-amber-500" />
                        <div className="size-1.5 md:size-2.5 rounded-full bg-green-500" />
                      </div>
                      <div className="space-y-1 md:space-y-2">
                        <div className="h-1.5 md:h-2 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-1.5 md:h-2 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-1.5 md:h-2 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
                        <div className="h-1.5 md:h-2 w-4/5 bg-slate-200 dark:bg-slate-700 rounded" />
                      </div>
                      <div className="mt-2 md:mt-4 flex justify-between items-center">
                        <div className="flex -space-x-1 md:-space-x-2">
                          <div className="size-4 md:size-6 rounded-full bg-primary border-2 border-white dark:border-slate-800" />
                          <div className="size-4 md:size-6 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-800" />
                        </div>
                        <div className="px-1.5 md:px-2 py-0.5 bg-green-500/10 text-green-600 rounded text-[8px] md:text-xs font-bold">
                          Published
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <span className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1 animate-pulse" style={{ backgroundColor: '#fdecf5', color: '#db2777' }}>
                  <span className="material-symbols-outlined text-[12px] md:text-[14px]">local_fire_department</span>
                  인기
                </span>
              </div>
              <div className="w-2/3 lg:w-auto p-3 md:p-6 lg:p-12 flex flex-col justify-center h-full order-2 lg:order-1">
                <div className="flex items-center gap-2 mb-1 md:mb-4 lg:mb-6">
                  {user?.role === 'ADMIN' && featuredPost.status === 'PRIVATE' && (
                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                      <span className="text-xs font-medium">비공개</span>
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm">
                    {formatDate(featuredPost.publishedAt || featuredPost.createdAt)}
                  </span>
                </div>
                <h2 className="text-base md:text-2xl lg:text-4xl font-bold tracking-tight mb-1 md:mb-3 lg:mb-4 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                  {featuredPost.title}
                </h2>
                <p className="hidden md:block text-slate-600 dark:text-slate-400 text-sm lg:text-lg leading-relaxed mb-4 lg:mb-8 line-clamp-2 lg:line-clamp-none">
                  {featuredPost.excerpt}
                </p>
                <div className="hidden md:flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mt-auto">
                  <span>자세히 읽기</span>
                  <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="relative overflow-hidden rounded-xl md:rounded-2xl card shadow-sm group cursor-pointer">
            <div className="flex flex-row lg:grid lg:grid-cols-2 lg:gap-8 items-center">
              <div className="w-1/3 lg:w-auto min-h-[120px] md:min-h-[200px] lg:min-h-[320px] lg:h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center relative overflow-hidden order-1 lg:order-2">
                <span className="material-symbols-outlined text-3xl md:text-5xl text-slate-400">
                  article
                </span>
                <span className="absolute top-2 left-2 md:top-3 md:left-3 px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-bold flex items-center gap-1" style={{ backgroundColor: '#fdecf5', color: '#db2777' }}>
                  <span className="material-symbols-outlined text-[12px] md:text-[14px]">local_fire_department</span>
                  인기
                </span>
              </div>
              <div className="w-2/3 lg:w-auto p-3 md:p-6 lg:p-12 flex flex-col justify-center h-full order-2 lg:order-1">
                <div className="flex items-center gap-2 mb-1 md:mb-4 lg:mb-6">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm">
                    Coming Soon
                  </span>
                </div>
                <h2 className="text-base md:text-2xl lg:text-4xl font-bold tracking-tight mb-1 md:mb-3 lg:mb-4 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                  첫 번째 글을 작성해보세요
                </h2>
                <p className="hidden md:block text-slate-600 dark:text-slate-400 text-sm lg:text-lg leading-relaxed mb-4 lg:mb-8 line-clamp-2">
                  DevOps, MLOps, 클라우드 인프라에 대한 기술 글을 공유합니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="mb-10 md:mb-16">
        <div className="flex items-end justify-between mb-4 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-1 md:mb-2">주요 주제</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">
              DevOps와 AI 기술의 핵심 영역을 탐구합니다.
            </p>
          </div>
          <Link
            to="/categories"
            className="text-sm font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors hidden sm:block"
          >
            전체 카테고리 보기
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {displayCategories.map((category) => {
            const cat = 'slug' in category ? category : { ...category, slug: category.name.toLowerCase().replace(/ /g, '-') }
            const icon = 'icon' in category && category.icon ? category.icon : 'folder'
            const color = 'color' in category && category.color ? category.color : 'blue'
            const description = 'description' in category && category.description ? category.description : ''

            return (
              <Link
                key={cat.name}
                to={`/categories/${cat.slug}`}
                className="group p-4 md:p-6 rounded-xl card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
              >
                <div
                  className={`size-10 md:size-12 rounded-lg bg-${color}-500/10 text-${color}-500 flex items-center justify-center mb-2 md:mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <span className="material-symbols-outlined text-[24px] md:text-[28px]">{icon}</span>
                </div>
                <h3 className="text-base md:text-lg font-bold mb-1 md:mb-2 group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm line-clamp-2">
                  {description}
                </p>
              </Link>
            )
          })}
        </div>
        {/* Mobile: 전체 카테고리 보기 링크 */}
        <Link
          to="/categories"
          className="sm:hidden flex items-center justify-center gap-2 py-3 mt-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <span className="font-medium text-sm text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">
            전체 카테고리 보기
          </span>
          <span className="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all">
            arrow_forward
          </span>
        </Link>
      </section>

      {/* Latest Posts with Sidebar */}
      <section>
        <div className="flex items-center justify-between mb-4 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">최신 게시글</h2>
          <Link
            to="/posts"
            className="text-sm font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            전체 글 보기
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content */}
          <main className="lg:col-span-8">
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                  progress_activity
                </span>
              </div>
            ) : latestPosts.length > 0 ? (
              <div className="flex flex-col gap-4 md:gap-6">
                {latestPosts.map((post) => (
                  <article
                    key={post.id}
                    className="group flex flex-row gap-3 md:gap-6 items-start pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800"
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
                        <span className="text-slate-400">{formatDate(post.publishedAt || post.createdAt)}</span>
                      </div>
                      <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 group-hover:text-primary transition-colors line-clamp-2 md:line-clamp-1">
                        <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <Link to={`/posts/${post.slug}`} className="hidden md:block text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3">
                        {post.excerpt}
                      </Link>
                      <div className="flex items-center gap-2 md:gap-4 mt-auto">
                        <div className="flex items-center gap-1 text-slate-400 text-[10px] md:text-xs">
                          <span className="material-symbols-outlined text-[14px] md:text-[16px]">visibility</span>
                          {post.viewCount >= 1000 ? `${(post.viewCount / 1000).toFixed(1)}k` : post.viewCount}
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
                {/* 모든 글 보러가기 */}
                <Link
                  to="/posts"
                  className="flex items-center justify-center gap-2 py-3 md:py-4 mt-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <span className="font-medium text-sm md:text-base text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors">
                    모든 글 보러가기
                  </span>
                  <span className="material-symbols-outlined text-[18px] md:text-[20px] text-slate-400 group-hover:text-primary group-hover:translate-x-1 transition-all">
                    arrow_forward
                  </span>
                </Link>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                <span className="material-symbols-outlined text-[48px] mb-4 block">article</span>
                <p>아직 게시글이 없습니다.</p>
                <p className="text-sm">첫 번째 글을 작성해보세요!</p>
              </div>
            )}
          </main>

          {/* Sidebar */}
          <Sidebar />
        </div>
      </section>

      {/* Mobile Profile Modal */}
      <MobileProfileModal />

      {/* Notice Modal */}
      <NoticeModal />
    </div>
  )
}
