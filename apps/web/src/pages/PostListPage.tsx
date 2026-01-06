export default function PostListPage() {
  return (
    <div className="container-wrapper py-8">
      <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">글 목록</h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          DevOps, MLOps, 클라우드 인프라에 대한 기술 글을 공유합니다.
        </p>
      </div>

      {/* Category Filter */}
      <div className="sticky top-16 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm py-4 -mx-2 px-2 border-b border-transparent mb-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className="whitespace-nowrap px-4 py-1.5 rounded-full bg-primary text-white text-sm font-medium shadow-md shadow-primary/20">
            전체
          </button>
          {['DevOps', 'Kubernetes', 'CI/CD', 'ML Infrastructure', 'Monitoring'].map((cat) => (
            <button
              key={cat}
              className="whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-200 dark:bg-secondary-dark text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Posts List */}
      <div className="text-center py-16 text-slate-500 dark:text-slate-400">
        <span className="material-symbols-outlined text-[48px] mb-4 block">article</span>
        <p>아직 게시글이 없습니다.</p>
        <p className="text-sm">첫 번째 글을 작성해보세요!</p>
      </div>
    </div>
  )
}
