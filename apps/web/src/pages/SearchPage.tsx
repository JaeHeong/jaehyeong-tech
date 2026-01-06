import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

// Mock data - will be replaced with API calls
const mockSearchResults = [
  {
    id: '1',
    slug: 'devops-roadmap-2024',
    title: 'DevOps 엔지니어 로드맵 2024: 기초부터 마스터까지',
    excerpt:
      'DevOps 엔지니어가 되기 위해 필요한 기술 스택과 학습 순서를 정리했습니다. Linux 기초부터 CI/CD 파이프라인 구축, 그리고 최신 Cloud Native 기술 트렌드까지 단계별로 상세히 알아봅니다.',
    category: { name: 'DevOps', color: 'blue' },
    icon: 'rocket_launch',
    viewCount: 2400,
    readingTime: 10,
    createdAt: '2023. 10. 24',
  },
  {
    id: '2',
    slug: 'argocd-gitops',
    title: 'ArgoCD를 활용한 GitOps 기반 배포 자동화',
    excerpt:
      '쿠버네티스 환경에서 ArgoCD를 도입하여 GitOps 워크플로우를 구축하는 방법을 소개합니다. 애플리케이션 상태를 Git 리포지토리에서 선언적으로 관리하고 자동 동기화하는 과정을 실습합니다.',
    category: { name: 'Kubernetes', color: 'indigo' },
    icon: 'anchor',
    viewCount: 1800,
    readingTime: 15,
    createdAt: '2023. 09. 15',
  },
  {
    id: '3',
    slug: 'aws-eks-best-practices',
    title: 'AWS EKS 클러스터 구축 모범 사례 가이드',
    excerpt:
      '안정적이고 확장 가능한 EKS 클러스터를 구축하기 위한 Terraform 코드 예제와 보안 그룹, IAM 역할 설정 등 프로덕션 환경에서의 모범 사례를 공유합니다.',
    category: { name: 'Cloud Native', color: 'orange' },
    icon: 'cloud_queue',
    viewCount: 1500,
    readingTime: 12,
    createdAt: '2023. 08. 02',
  },
  {
    id: '4',
    slug: 'terraform-multi-cloud',
    title: 'Terraform으로 관리하는 멀티 클라우드 인프라',
    excerpt:
      '단일 클라우드 종속성을 줄이기 위해 AWS와 GCP를 동시에 사용하는 전략. Terraform 모듈을 활용해 재사용 가능한 인프라 코드를 작성하는 방법을 다룹니다.',
    category: { name: 'IaC', color: 'pink' },
    icon: 'code_blocks',
    viewCount: 1200,
    readingTime: 8,
    createdAt: '2023. 06. 10',
  },
]

const trendingTopics = [
  { title: 'Docker Compose V2 출시', category: 'DevOps', views: '2k' },
  { title: 'LLM 파인튜닝 이해하기', category: 'MLOps', views: '1.8k' },
  { title: 'ArgoCD를 활용한 GitOps', category: 'Cloud Native', views: '1.5k' },
  { title: 'Python 3.12 성능 개선', category: 'Programming', views: '1.2k' },
]

const defaultColors = {
  bg: 'bg-blue-50',
  text: 'text-blue-600',
  darkBg: 'dark:bg-blue-900/20',
  darkText: 'dark:text-blue-400',
}

const categoryColorMap: Record<string, typeof defaultColors> = {
  blue: defaultColors,
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    darkBg: 'dark:bg-indigo-900/20',
    darkText: 'dark:text-indigo-400',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    darkBg: 'dark:bg-orange-900/20',
    darkText: 'dark:text-orange-400',
  },
  pink: {
    bg: 'bg-pink-50',
    text: 'text-pink-600',
    darkBg: 'dark:bg-pink-900/20',
    darkText: 'dark:text-pink-400',
  },
}

const iconBgMap: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/10 text-blue-500/80',
  indigo: 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-500/80',
  orange: 'bg-orange-50 dark:bg-orange-900/10 text-orange-500/80',
  pink: 'bg-pink-50 dark:bg-pink-900/10 text-pink-500/80',
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const [sortBy, setSortBy] = useState<'latest' | 'relevance'>('latest')
  const [results, setResults] = useState(mockSearchResults)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Simulate API call
    setIsLoading(true)
    const timer = setTimeout(() => {
      // Filter mock data based on query
      if (query) {
        const filtered = mockSearchResults.filter(
          (post) =>
            post.title.toLowerCase().includes(query.toLowerCase()) ||
            post.excerpt.toLowerCase().includes(query.toLowerCase()) ||
            post.category.name.toLowerCase().includes(query.toLowerCase())
        )
        setResults(filtered)
      } else {
        setResults(mockSearchResults)
      }
      setIsLoading(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const searchQuery = formData.get('search') as string
    setSearchParams({ q: searchQuery })
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
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="lg:hidden">
              <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 text-[20px]">
                    search
                  </span>
                </div>
                <input
                  name="search"
                  defaultValue={query}
                  className="block w-full py-2.5 pl-4 pr-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="검색어를 입력하세요..."
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
                  총 {results.length}개의 게시물을 찾았습니다.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={() => setSortBy('latest')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                    sortBy === 'latest'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">sort</span> 최신순
                </button>
                <button
                  onClick={() => setSortBy('relevance')}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    sortBy === 'relevance'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  관련도순
                </button>
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
          ) : results.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
                search_off
              </span>
              <h3 className="text-lg font-bold mb-2">검색 결과가 없습니다</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                다른 검색어로 다시 시도해보세요.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {results.map((post) => {
                const colors = categoryColorMap[post.category.color] ?? defaultColors
                const iconBg = iconBgMap[post.category.color] ?? 'bg-blue-50 dark:bg-blue-900/10 text-blue-500/80'

                return (
                  <article
                    key={post.id}
                    className="group flex flex-col md:flex-row gap-6 items-start pb-8 border-b border-slate-200 dark:border-slate-800 last:border-0"
                  >
                    <div
                      className={`w-full md:w-48 aspect-video md:aspect-[4/3] rounded-lg flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-800/50 group-hover:border-primary/20 transition-colors ${iconBg}`}
                    >
                      <span className="material-symbols-outlined text-4xl">{post.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col h-full">
                      <div className="flex items-center gap-3 text-xs mb-2">
                        <span
                          className={`font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text} ${colors.darkBg} ${colors.darkText}`}
                        >
                          {post.category.name}
                        </span>
                        <span className="text-slate-400">{post.createdAt}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-1">
                        <Link to={`/posts/${post.slug}`}>{post.title}</Link>
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-2 mb-3">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-4 mt-auto">
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <span className="material-symbols-outlined text-[16px]">visibility</span>{' '}
                          {formatViewCount(post.viewCount)}
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-xs">
                          <span className="material-symbols-outlined text-[16px]">schedule</span>{' '}
                          {post.readingTime} min
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {results.length > 0 && (
            <div className="flex justify-center items-center gap-2 pt-8">
              <button
                className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                disabled
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-md shadow-primary/20">
                1
              </button>
              <button className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors">
                2
              </button>
              <button className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors">
                3
              </button>
              <span className="text-slate-400 px-2">...</span>
              <button className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors">
                10
              </button>
              <button className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          )}
        </main>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-8">
          {/* Author Card */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="size-16 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
              </div>
              <div>
                <h3 className="text-lg font-bold">Jaehyeong</h3>
                <p className="text-xs text-primary font-medium">DevOps Engineer</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 열정을 가진 엔지니어입니다.
              배운 것을 기록하고 공유합니다.
            </p>
            <div className="flex gap-2">
              <a
                href="https://github.com/JaeHeong"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
              >
                Github
              </a>
              <a
                href="#"
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
              >
                Twitter
              </a>
            </div>
          </div>

          {/* Trending Topics */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm sticky top-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                <span className="material-symbols-outlined">trending_up</span>
              </div>
              <h3 className="text-lg font-bold">인기 토픽</h3>
            </div>
            <div className="flex flex-col gap-4">
              {trendingTopics.map((topic, index) => (
                <Link
                  key={index}
                  to={`/search?q=${encodeURIComponent(topic.title)}`}
                  className={`group flex items-start gap-3 ${
                    index < trendingTopics.length - 1
                      ? 'pb-4 border-b border-slate-100 dark:border-slate-800/50'
                      : ''
                  }`}
                >
                  <span className="text-2xl font-bold text-slate-300 dark:text-slate-700 group-hover:text-primary transition-colors">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors mb-1">
                      {topic.title}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      {topic.category} • {topic.views} 읽음
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
