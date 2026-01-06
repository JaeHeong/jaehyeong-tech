const skills = [
  { name: 'DevOps', color: 'primary', description: 'CI/CD 파이프라인 구축, IaC(Terraform) 관리, 컨테이너 오케스트레이션' },
  { name: 'MLOps', color: 'purple-500', description: '모델 학습/배포 자동화, Kubeflow 파이프라인, 모델 모니터링 시스템' },
  { name: 'Cloud Native', color: 'blue-500', description: 'Kubernetes 운영 및 트러블슈팅, Service Mesh, MSA 아키텍처' },
  { name: 'Backend', color: 'green-500', description: 'Python/Go 기반 API 서버 개발, 대규모 트래픽 처리 및 최적화' },
]

export default function IntroducePage() {
  return (
    <main className="flex-grow w-full container-wrapper py-12 md:py-16">
      <div className="max-w-4xl mx-auto">
        <div className="card overflow-hidden">
          {/* Cover */}
          <div className="h-32 md:h-48 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 relative">
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(#3182f6 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
          </div>

          <div className="px-8 pb-10 md:px-12 md:pb-12 -mt-16 md:-mt-20 relative">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar */}
              <div className="shrink-0 relative">
                <div className="size-32 md:size-40 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-card-light dark:border-card-dark shadow-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[64px] text-slate-400 dark:text-slate-500">
                    person
                  </span>
                </div>
                <div
                  className="absolute bottom-2 right-2 bg-green-500 size-4 md:size-5 rounded-full border-4 border-card-light dark:border-card-dark"
                  title="Open to work"
                />
              </div>

              {/* Info */}
              <div className="flex-1 pt-4 md:pt-20 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  Jaehyeong
                </h1>
                <p className="text-lg md:text-xl text-primary font-medium mb-4">
                  DevOps & MLOps Engineer
                </p>
                <div className="flex gap-3 justify-center md:justify-start">
                  <a
                    href="https://github.com/JaeHeong"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors text-slate-600 dark:text-slate-400"
                  >
                    <span className="material-symbols-outlined">code</span>
                  </a>
                  <a
                    href="#"
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors text-slate-600 dark:text-slate-400"
                  >
                    <span className="material-symbols-outlined">work</span>
                  </a>
                  <a
                    href="mailto:contact@jaehyeong.site"
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors text-slate-600 dark:text-slate-400"
                  >
                    <span className="material-symbols-outlined">alternate_email</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-10">
              {/* Introduction */}
              <section>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">waving_hand</span>
                  안녕하세요
                </h2>
                <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
                  <p>
                    클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 깊은 열정을 가진 엔지니어 Jaehyeong입니다.
                    복잡한 시스템을 효율적으로 관리하고, 데이터 과학자들이 모델 개발에만 온전히 집중할 수 있는 환경을 만드는 것에 큰 보람을 느낍니다.
                  </p>
                  <p>
                    새로운 기술을 탐구하는 것을 즐기며, 문제를 해결하는 과정에서 얻은 통찰력을 팀과 공유하는 문화를 지향합니다.
                    단순히 "작동하는" 코드를 넘어, "유지보수하기 쉽고 확장 가능한" 인프라를 설계하기 위해 끊임없이 고민합니다.
                  </p>
                </div>
              </section>

              {/* Skills */}
              <section>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  전문 분야
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {skills.map((skill) => (
                    <div
                      key={skill.name}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors"
                    >
                      <div className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <span className={`size-2 rounded-full bg-${skill.color}`} />
                        {skill.name}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {skill.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Blog Purpose */}
              <section className="p-6 rounded-xl bg-primary/5 border border-primary/10">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">rocket_launch</span>
                  블로그 운영 목적
                </h2>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base">
                  이 블로그는 제가 학습한 기술과 실무에서 직접 부딪히며 겪은 문제 해결 과정을 기록하는{' '}
                  <b>'성장 로그'</b>이자 <b>'지식 공유소'</b>입니다.
                  <br className="hidden md:block" />
                  혼자만의 지식으로 남겨두기보다, 글로 정리하여 공유함으로써 더 나은 개발 생태계에 기여하고 저 또한 피드백을 통해 한 단계 더 성장하고자 합니다.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
