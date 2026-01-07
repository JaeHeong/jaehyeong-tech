import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { Post, Category } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from '../components/Sidebar'

export default function HomePage() {
  const { user } = useAuth()
  const [featuredPost, setFeaturedPost] = useState<Post | null>(null)
  const [latestPosts, setLatestPosts] = useState<Post[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch featured post
        const featuredRes = await api.getPosts({ featured: true, limit: 1 })
        if (featuredRes.posts.length > 0) {
          setFeaturedPost(featuredRes.posts[0] ?? null)
        }

        // Fetch latest posts
        const postsRes = await api.getPosts({ limit: 6 })
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
      <section className="mb-16">
        {featuredPost ? (
          <Link
            to={`/posts/${featuredPost.slug}`}
            className="relative overflow-hidden rounded-2xl card shadow-sm hover:shadow-md transition-shadow group cursor-pointer block"
          >
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="p-8 lg:p-12 flex flex-col justify-center h-full">
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                    Featured
                  </span>
                  {user?.role === 'ADMIN' && featuredPost.status === 'PRIVATE' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                      <span className="text-xs font-medium">비공개</span>
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    {formatDate(featuredPost.publishedAt || featuredPost.createdAt)}
                  </span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 leading-tight group-hover:text-primary transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mt-auto">
                  <span>자세히 읽기</span>
                  <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </div>
              </div>
              {featuredPost.coverImage ? (
                <div
                  className="h-64 lg:h-full min-h-[320px] bg-cover bg-center"
                  style={{ backgroundImage: `url(${featuredPost.coverImage})` }}
                />
              ) : (
                <div className="h-64 lg:h-full min-h-[320px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center relative overflow-hidden">
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
                      backgroundSize: '24px 24px',
                    }}
                  />
                  <div className="p-8 bg-card-light dark:bg-card-dark rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-8 transform rotate-3 transition-transform group-hover:rotate-0 duration-500">
                    <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <div className="size-3 rounded-full bg-red-500" />
                      <div className="size-3 rounded-full bg-amber-500" />
                      <div className="size-3 rounded-full bg-green-500" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-2 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-2 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="h-2 w-4/5 bg-slate-200 dark:bg-slate-700 rounded" />
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                      <div className="flex -space-x-2">
                        <div className="size-8 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800" />
                        <div className="size-8 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-800" />
                      </div>
                      <div className="px-3 py-1 bg-green-500/10 text-green-600 rounded text-xs font-bold">
                        Passing
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Link>
        ) : (
          <div className="relative overflow-hidden rounded-2xl card shadow-sm group cursor-pointer">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="p-8 lg:p-12 flex flex-col justify-center h-full">
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                    Featured
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">
                    Coming Soon
                  </span>
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 leading-tight group-hover:text-primary transition-colors">
                  Kubernetes 환경에서의 대규모 MLOps 파이프라인 구축 가이드
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8">
                  Kubeflow와 MLflow를 활용하여 모델 학습부터 배포, 모니터링까지 이어지는 엔드투엔드 머신러닝 파이프라인을 구축했던 경험과 마주했던 트러블슈팅 과정을 상세히 공유합니다.
                </p>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white mt-auto">
                  <span>자세히 읽기</span>
                  <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </div>
              </div>
              <div className="h-64 lg:h-full min-h-[320px] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, gray 1px, transparent 0)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <div className="p-8 bg-card-light dark:bg-card-dark rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-8 transform rotate-3 transition-transform group-hover:rotate-0 duration-500">
                  <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                    <div className="size-3 rounded-full bg-red-500" />
                    <div className="size-3 rounded-full bg-amber-500" />
                    <div className="size-3 rounded-full bg-green-500" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-2 w-5/6 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-2 w-4/5 bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                  <div className="mt-6 flex justify-between items-center">
                    <div className="flex -space-x-2">
                      <div className="size-8 rounded-full bg-blue-500 border-2 border-white dark:border-slate-800" />
                      <div className="size-8 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-800" />
                    </div>
                    <div className="px-3 py-1 bg-green-500/10 text-green-600 rounded text-xs font-bold">
                      Passing
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="mb-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">주요 주제</h2>
            <p className="text-slate-500 dark:text-slate-400">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayCategories.map((category) => {
            const cat = 'slug' in category ? category : { ...category, slug: category.name.toLowerCase().replace(/ /g, '-') }
            const icon = 'icon' in category && category.icon ? category.icon : 'folder'
            const color = 'color' in category && category.color ? category.color : 'blue'
            const description = 'description' in category && category.description ? category.description : ''

            return (
              <Link
                key={cat.name}
                to={`/categories/${cat.slug}`}
                className="group p-6 rounded-xl card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer"
              >
                <div
                  className={`size-12 rounded-lg bg-${color}-500/10 text-${color}-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <span className="material-symbols-outlined text-[28px]">{icon}</span>
                </div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                  {cat.name}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
                  {description}
                </p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Latest Posts with Sidebar */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight">최신 게시글</h2>
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
              <div className="flex flex-col gap-6">
                {latestPosts.map((post) => (
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
                        {user?.role === 'ADMIN' && post.status === 'PRIVATE' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                            <span className="text-[10px] font-medium">비공개</span>
                          </span>
                        )}
                        <span className="text-slate-400">{formatDate(post.publishedAt || post.createdAt)}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                        <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <Link to={`/posts/${post.slug}`} className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3 block">
                        {post.excerpt}
                      </Link>
                      <div className="flex items-center gap-4 mt-auto">
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          {post.viewCount >= 1000 ? `${(post.viewCount / 1000).toFixed(1)}k` : post.viewCount}
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
          </main>

          {/* Sidebar */}
          <Sidebar />
        </div>
      </section>
    </div>
  )
}
