import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import api from '../services/api'

interface PrivacySection {
  title: string
  content: string
  list?: string[]
  additionalContent?: string[]
}

interface PrivacyContent {
  lastUpdated: string
  sections: PrivacySection[]
  contact: {
    email: string
  }
}

// Default content (fallback)
const defaultContent: PrivacyContent = {
  lastUpdated: '2025년 1월 6일',
  sections: [],
  contact: {
    email: 'rlawogud970301@gmail.com',
  },
}

export default function PrivacyPolicyPage() {
  const [content, setContent] = useState<PrivacyContent>(defaultContent)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    try {
      const response = await api.getPageBySlug('privacy')
      if (response.page?.content) {
        const parsed = JSON.parse(response.page.content)
        setContent(parsed)
      }
    } catch (error) {
      console.error('Failed to load privacy page content:', error)
      // Use default content on error
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
              <span>Privacy & Legal</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">개인정보처리방침</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              jaehyeong tech 블로그 방문자의 개인정보 보호를 위한 정책입니다.
            </p>
          </div>

          {/* Policy Content Card */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
            {/* Card Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center rounded-t-xl">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                최종 수정일: {content.lastUpdated}
              </span>
              <div className="flex gap-2">
                <div className="size-3 rounded-full bg-red-400/80" />
                <div className="size-3 rounded-full bg-yellow-400/80" />
                <div className="size-3 rounded-full bg-green-400/80" />
              </div>
            </div>

            {/* Policy Content */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              <article className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
                {content.sections.map((section, index) => (
                  <div key={index}>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                      {section.title}
                    </h3>
                    <p className="mb-2">{section.content}</p>
                    {section.list && (
                      <ul className="list-disc pl-5 mb-4 space-y-1">
                        {section.list.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    )}
                    {section.additionalContent?.map((text, i) => (
                      <p key={i} className="mb-2">{text}</p>
                    ))}
                    <div className="mb-6" />
                  </div>
                ))}

                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    이메일: {content.contact.email}
                  </p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                  <p>부칙</p>
                  <p>이 방침은 {content.lastUpdated}부터 시행합니다.</p>
                </div>
              </article>
            </div>
          </div>

          {/* Contact CTA */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800/20 rounded-xl p-6 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-primary">
                <span className="material-symbols-outlined">shield</span>
              </div>
              <div>
                <h4 className="font-bold text-lg text-slate-900 dark:text-white">문의하기</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  개인정보 처리와 관련된 궁금한 점이 있으신가요?
                </p>
              </div>
            </div>
            <a
              href={`mailto:${content.contact.email}`}
              className="w-full sm:w-auto px-6 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-900 dark:text-white text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm transition-all text-center"
            >
              이메일 보내기
            </a>
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>
    </div>
  )
}
