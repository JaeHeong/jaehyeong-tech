import { Link } from 'react-router-dom'

const categories = [
  { name: 'DevOps', icon: 'settings_suggest', color: 'blue', posts: 0, description: '개발과 운영의 경계를 허무는 문화와 도구. Docker, CI/CD, 자동화 프로세스 구축에 대한 이야기입니다.' },
  { name: 'MLOps', icon: 'psychology', color: 'purple', posts: 0, description: '머신러닝 모델의 생애주기 관리. 모델 학습부터 배포, 모니터링 파이프라인 구축을 다룹니다.' },
  { name: 'Kubernetes', icon: 'anchor', color: 'indigo', posts: 0, description: '컨테이너 오케스트레이션의 표준. 클러스터 관리, Helm 차트, 서비스 메쉬 및 운영 노하우.' },
  { name: 'Cloud Native', icon: 'cloud', color: 'orange', posts: 0, description: 'AWS, GCP 등 퍼블릭 클라우드 활용법과 클라우드 네이티브 아키텍처 설계 패턴을 탐구합니다.' },
  { name: 'AI & ML', icon: 'smart_toy', color: 'green', posts: 0, description: '최신 딥러닝 트렌드, LLM 활용 사례, 그리고 데이터 사이언스 실무 팁을 공유합니다.' },
  { name: 'IaC', icon: 'code_blocks', color: 'pink', posts: 0, description: 'Terraform, Ansible 등을 이용한 인프라 코드 관리. 불변 인프라 구축을 위한 가이드.' },
  { name: 'Monitoring', icon: 'monitoring', color: 'teal', posts: 0, description: 'Prometheus, Grafana를 활용한 시스템 관측 가능성(Observability) 확보 및 로깅 전략.' },
  { name: 'Security', icon: 'lock', color: 'red', posts: 0, description: 'DevSecOps, 클라우드 보안, 컴플라이언스 준수 및 취약점 관리에 대한 중요 정보.' },
]

export default function CategoryPage() {
  return (
    <div className="container-wrapper py-8">
      <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">주제별 탐색</h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          관심 있는 기술 주제를 선택하여 깊이 있는 지식을 탐구해보세요.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {categories.map((category) => (
          <Link
            key={category.name}
            to={`/categories/${category.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
            className="group flex flex-col p-6 card hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer h-full"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 bg-${category.color}-500/10 rounded-lg text-${category.color}-500 group-hover:bg-${category.color}-500 group-hover:text-white transition-colors`}>
                <span className="material-symbols-outlined text-[28px]">{category.icon}</span>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700">
                {category.posts} Posts
              </span>
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              {category.name}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-4 flex-1">
              {category.description}
            </p>
            <div className="flex items-center text-primary text-sm font-bold mt-auto">
              탐색하기
              <span className="material-symbols-outlined text-[16px] ml-1 transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
