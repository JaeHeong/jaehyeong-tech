import { Link } from 'react-router-dom'

const categories = [
  { name: 'DevOps', icon: 'settings_suggest', color: 'blue', description: 'CI/CD 파이프라인, 자동화, 그리고 인프라 관리에 대한 실무 가이드' },
  { name: 'MLOps', icon: 'psychology', color: 'purple', description: '모델 서빙, 모니터링, 데이터 파이프라인 구축을 위한 엔지니어링' },
  { name: 'Cloud Native', icon: 'cloud', color: 'orange', description: 'Kubernetes, Docker 및 클라우드 네이티브 아키텍처 패턴' },
  { name: 'AI & ML', icon: 'smart_toy', color: 'green', description: '최신 AI 트렌드, LLM 활용법 및 데이터 사이언스 인사이트' },
]

export default function HomePage() {
  return (
    <div className="container-wrapper py-10">
      {/* Featured Post */}
      <section className="mb-16">
        <div className="relative overflow-hidden rounded-2xl card shadow-sm hover:shadow-md transition-shadow group cursor-pointer">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="p-8 lg:p-12 flex flex-col justify-center h-full">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                  Featured
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-sm">
                  2024년 1월 6일
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
          {categories.map((category) => (
            <Link
              key={category.name}
              to={`/categories/${category.name.toLowerCase().replace(/ /g, '-')}`}
              className={`group p-6 rounded-xl card hover:border-${category.color}-500/50 hover:shadow-lg hover:shadow-${category.color}-500/5 transition-all cursor-pointer`}
            >
              <div
                className={`size-12 rounded-lg bg-${category.color}-500/10 text-${category.color}-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <span className="material-symbols-outlined text-[28px]">{category.icon}</span>
              </div>
              <h3 className={`text-lg font-bold mb-2 group-hover:text-${category.color}-500 transition-colors`}>
                {category.name}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2">
                {category.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest Posts */}
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
        <div className="text-center py-16 text-slate-500 dark:text-slate-400">
          <span className="material-symbols-outlined text-[48px] mb-4 block">article</span>
          <p>아직 게시글이 없습니다.</p>
          <p className="text-sm">첫 번째 글을 작성해보세요!</p>
        </div>
      </section>
    </div>
  )
}
