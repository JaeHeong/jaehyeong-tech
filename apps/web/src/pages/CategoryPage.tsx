import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { Category } from '../services/api'
import Sidebar from '../components/Sidebar'

const defaultCategories = [
  { name: 'DevOps', icon: 'settings_suggest', color: 'blue', posts: 0, description: '개발과 운영의 경계를 허무는 문화와 도구. Docker, CI/CD, 자동화 프로세스 구축에 대한 이야기입니다.' },
  { name: 'MLOps', icon: 'psychology', color: 'purple', posts: 0, description: '머신러닝 모델의 생애주기 관리. 모델 학습부터 배포, 모니터링 파이프라인 구축을 다룹니다.' },
  { name: 'Kubernetes', icon: 'anchor', color: 'indigo', posts: 0, description: '컨테이너 오케스트레이션의 표준. 클러스터 관리, Helm 차트, 서비스 메쉬 및 운영 노하우.' },
  { name: 'Cloud Native', icon: 'cloud', color: 'orange', posts: 0, description: 'AWS, GCP 등 퍼블릭 클라우드 활용법과 클라우드 네이티브 아키텍처 설계 패턴을 탐구합니다.' },
  { name: 'AI & ML', icon: 'smart_toy', color: 'green', posts: 0, description: '최신 딥러닝 트렌드, LLM 활용 사례, 그리고 데이터 사이언스 실무 팁을 공유합니다.' },
  { name: 'IaC', icon: 'code_blocks', color: 'pink', posts: 0, description: 'Terraform, Ansible 등을 이용한 인프라 코드 관리. 불변 인프라 구축을 위한 가이드.' },
  { name: 'Monitoring', icon: 'monitoring', color: 'teal', posts: 0, description: 'Prometheus, Grafana를 활용한 시스템 관측 가능성(Observability) 확보 및 로깅 전략.' },
  { name: 'Security', icon: 'lock', color: 'red', posts: 0, description: 'DevSecOps, 클라우드 보안, 컴플라이언스 준수 및 취약점 관리에 대한 중요 정보.' },
]

const categoryColorClasses: Record<string, { icon: string; hover: string }> = {
  blue: { icon: 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500', hover: 'group-hover:border-blue-200 dark:group-hover:border-blue-900' },
  purple: { icon: 'bg-purple-500/10 text-purple-500 group-hover:bg-purple-500', hover: 'group-hover:border-purple-200 dark:group-hover:border-purple-900' },
  indigo: { icon: 'bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500', hover: 'group-hover:border-indigo-200 dark:group-hover:border-indigo-900' },
  orange: { icon: 'bg-orange-500/10 text-orange-500 group-hover:bg-orange-500', hover: 'group-hover:border-orange-200 dark:group-hover:border-orange-900' },
  green: { icon: 'bg-green-500/10 text-green-500 group-hover:bg-green-500', hover: 'group-hover:border-green-200 dark:group-hover:border-green-900' },
  pink: { icon: 'bg-pink-500/10 text-pink-500 group-hover:bg-pink-500', hover: 'group-hover:border-pink-200 dark:group-hover:border-pink-900' },
  teal: { icon: 'bg-teal-500/10 text-teal-500 group-hover:bg-teal-500', hover: 'group-hover:border-teal-200 dark:group-hover:border-teal-900' },
  red: { icon: 'bg-red-500/10 text-red-500 group-hover:bg-red-500', hover: 'group-hover:border-red-200 dark:group-hover:border-red-900' },
}

export default function CategoryPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { categories } = await api.getCategories()
        setCategories(categories)
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCategories()
  }, [])

  const displayCategories = categories.length > 0 ? categories : defaultCategories

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <h1 className="text-3xl font-bold tracking-tight">주제별 탐색</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              관심 있는 기술 주제를 선택하여 깊이 있는 지식을 탐구해보세요.
            </p>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">
                progress_activity
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {displayCategories.map((category) => {
                const cat = 'slug' in category ? category : { ...category, slug: category.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-') }
                const icon = 'icon' in category && category.icon ? category.icon : 'folder'
                const color = 'color' in category && category.color ? category.color : 'blue'
                const description = 'description' in category && category.description ? category.description : ''
                const postCount = 'postCount' in category ? category.postCount : ('posts' in category ? category.posts : 0)
                const colorClasses = categoryColorClasses[color] ?? { icon: 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500', hover: 'group-hover:border-blue-200 dark:group-hover:border-blue-900' }

                return (
                  <Link
                    key={cat.name}
                    to={`/categories/${cat.slug}`}
                    className={`group flex flex-col p-6 card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer h-full`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-lg ${colorClasses.icon} group-hover:text-white transition-colors`}>
                        <span className="material-symbols-outlined text-[28px]">{icon}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700 ${colorClasses.hover} transition-colors`}>
                        {postCount} Posts
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4 flex-1">
                      {description}
                    </p>
                    <div className="flex items-center text-primary text-sm font-bold mt-auto">
                      탐색하기
                      <span className="material-symbols-outlined text-[16px] ml-1 transition-transform group-hover:translate-x-1">
                        arrow_forward
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  )
}
