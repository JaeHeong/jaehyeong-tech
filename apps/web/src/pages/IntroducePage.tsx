import { useState, useEffect } from 'react'
import api from '../services/api'

interface IntroduceContent {
  profile: {
    name: string
    title: string
    avatar: string | null
    links: {
      github: string
      linkedin: string
      email: string
    }
  }
  introduction: {
    title: string
    icon: string
    paragraphs: string[]
  }
  skills: {
    title: string
    icon: string
    items: Array<{
      name: string
      color: string
      description: string
    }>
  }
  blogPurpose: {
    title: string
    icon: string
    content: string
  }
}

// Color mapping for skill badges (Tailwind requires explicit class names)
const skillColorMap: Record<string, string> = {
  'primary': 'bg-primary',
  'blue-500': 'bg-blue-500',
  'purple-500': 'bg-purple-500',
  'green-500': 'bg-green-500',
  'red-500': 'bg-red-500',
  'yellow-500': 'bg-yellow-500',
  'orange-500': 'bg-orange-500',
  'pink-500': 'bg-pink-500',
  'cyan-500': 'bg-cyan-500',
}

// Default content (fallback)
const defaultContent: IntroduceContent = {
  profile: {
    name: 'Jaehyeong',
    title: 'DevOps & MLOps Engineer',
    avatar: null,
    links: {
      github: 'https://github.com/JaeHeong',
      linkedin: '#',
      email: 'contact@jaehyeong.site',
    },
  },
  introduction: {
    title: '안녕하세요',
    icon: 'waving_hand',
    paragraphs: [
      '클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 깊은 열정을 가진 엔지니어입니다.',
    ],
  },
  skills: {
    title: '전문 분야',
    icon: 'psychology',
    items: [
      { name: 'DevOps', color: 'primary', description: 'CI/CD 파이프라인 구축' },
    ],
  },
  blogPurpose: {
    title: '블로그 운영 목적',
    icon: 'rocket_launch',
    content: '기술 블로그입니다.',
  },
}

export default function IntroducePage() {
  const [content, setContent] = useState<IntroduceContent>(defaultContent)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    try {
      const response = await api.getPageBySlug('introduce')
      if (response.page?.content) {
        const parsed = JSON.parse(response.page.content)
        setContent(parsed)
      }
    } catch (error) {
      console.error('Failed to load introduce page content:', error)
      // Use default content on error
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="flex-grow w-full container-wrapper py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          </div>
        </div>
      </main>
    )
  }

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
                {content.profile.avatar ? (
                  <img
                    src={content.profile.avatar}
                    alt={content.profile.name}
                    className="size-32 md:size-40 rounded-full border-4 border-card-light dark:border-card-dark shadow-lg object-cover"
                  />
                ) : (
                  <div className="size-32 md:size-40 rounded-full bg-slate-200 dark:bg-slate-700 border-4 border-card-light dark:border-card-dark shadow-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-[64px] text-slate-400 dark:text-slate-500">
                      person
                    </span>
                  </div>
                )}
                <div
                  className="absolute bottom-2 right-2 bg-green-500 size-4 md:size-5 rounded-full border-4 border-card-light dark:border-card-dark"
                  title="Open to work"
                />
              </div>

              {/* Info */}
              <div className="flex-1 pt-4 md:pt-20 text-center md:text-left">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  {content.profile.name}
                </h1>
                <p className="text-lg md:text-xl text-primary font-medium mb-4">
                  {content.profile.title}
                </p>
                <div className="flex gap-3 justify-center md:justify-start">
                  {content.profile.links.github && (
                    <a
                      href={content.profile.links.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors text-slate-600 dark:text-slate-400"
                    >
                      <span className="material-symbols-outlined">code</span>
                    </a>
                  )}
                  {content.profile.links.linkedin && content.profile.links.linkedin !== '#' && (
                    <a
                      href={content.profile.links.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors text-slate-600 dark:text-slate-400"
                    >
                      <span className="material-symbols-outlined">work</span>
                    </a>
                  )}
                  {content.profile.links.email && (
                    <a
                      href={`mailto:${content.profile.links.email}`}
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-primary transition-colors text-slate-600 dark:text-slate-400"
                    >
                      <span className="material-symbols-outlined">alternate_email</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-10 space-y-10">
              {/* Introduction */}
              <section>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{content.introduction.icon}</span>
                  {content.introduction.title}
                </h2>
                <div className="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
                  {content.introduction.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>

              {/* Skills */}
              <section>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{content.skills.icon}</span>
                  {content.skills.title}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {content.skills.items.map((skill) => (
                    <div
                      key={skill.name}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-primary/30 transition-colors"
                    >
                      <div className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <span className={`size-2 rounded-full ${skillColorMap[skill.color] || 'bg-slate-500'}`} />
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
                  <span className="material-symbols-outlined text-primary">{content.blogPurpose.icon}</span>
                  {content.blogPurpose.title}
                </h2>
                <p
                  className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base"
                  dangerouslySetInnerHTML={{ __html: content.blogPurpose.content }}
                />
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
