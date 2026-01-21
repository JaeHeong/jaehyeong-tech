import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api, { type Page } from '../services/api'
import { useModal } from '../contexts/ModalContext'
import { sanitizeHtml } from '../utils/sanitize'

// Types for template content
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

// Preview Components
function IntroducePreview({ content }: { content: IntroduceContent }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
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
                  <span className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined">code</span>
                  </span>
                )}
                {content.profile.links.linkedin && content.profile.links.linkedin !== '#' && (
                  <span className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined">work</span>
                  </span>
                )}
                {content.profile.links.email && (
                  <span className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <span className="material-symbols-outlined">alternate_email</span>
                  </span>
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
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                  >
                    <div className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <span className={`size-2 rounded-full ${skill.color === 'primary' ? 'bg-primary' : `bg-${skill.color}`}`} />
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
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.blogPurpose.content) }}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrivacyPreview({ content }: { content: PrivacyContent }) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-2 pb-4 border-b border-slate-200 dark:border-slate-800 mb-8">
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
    </div>
  )
}

// Default templates
const defaultIntroduceContent: IntroduceContent = {
  profile: {
    name: 'Name',
    title: 'Title',
    avatar: null,
    links: { github: '', linkedin: '', email: '' },
  },
  introduction: {
    title: '안녕하세요',
    icon: 'waving_hand',
    paragraphs: ['소개 내용을 입력하세요.'],
  },
  skills: {
    title: '전문 분야',
    icon: 'psychology',
    items: [],
  },
  blogPurpose: {
    title: '블로그 운영 목적',
    icon: 'rocket_launch',
    content: '블로그 목적을 입력하세요.',
  },
}

const defaultPrivacyContent: PrivacyContent = {
  lastUpdated: new Date().toLocaleDateString('ko-KR'),
  sections: [],
  contact: { email: 'contact@example.com' },
}

export default function AdminPageEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { alert } = useModal()
  const [page, setPage] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [jsonContent, setJsonContent] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT')

  useEffect(() => {
    if (id) {
      loadPage()
    }
  }, [id])

  const loadPage = async () => {
    try {
      const response = await api.getPageById(id!)
      setPage(response.page)
      setTitle(response.page.title)
      setStatus(response.page.status)

      // Format JSON content for editing
      try {
        const parsed = JSON.parse(response.page.content)
        setJsonContent(JSON.stringify(parsed, null, 2))
      } catch {
        setJsonContent(response.page.content)
      }
    } catch (error) {
      console.error('Failed to load page:', error)
      await alert({ message: '페이지를 불러오는데 실패했습니다.', type: 'error' })
      navigate('/admin/pages?tab=STATIC')
    } finally {
      setLoading(false)
    }
  }

  // Parse JSON content for preview
  const parsedContent = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonContent)
      setParseError(null)
      return parsed
    } catch (e) {
      setParseError((e as Error).message)
      return null
    }
  }, [jsonContent])

  const handleSave = async () => {
    if (!page || !parsedContent) {
      await alert({ message: 'JSON 형식이 올바르지 않습니다.', type: 'error' })
      return
    }

    setSaving(true)
    try {
      await api.updatePage(page.id, {
        title,
        content: JSON.stringify(parsedContent),
        status,
      })
      await alert({ message: '저장되었습니다.', type: 'success' })
    } catch (error) {
      console.error('Failed to save page:', error)
      await alert({ message: '저장에 실패했습니다.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonContent)
      setJsonContent(JSON.stringify(parsed, null, 2))
      setParseError(null)
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 md:py-20">
        <div className="animate-spin rounded-full h-6 w-6 md:h-8 md:w-8 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="text-center py-12 md:py-20">
        <p className="text-slate-500 text-sm md:text-base">페이지를 찾을 수 없습니다.</p>
        <Link to="/admin/pages?tab=STATIC" className="text-primary hover:underline mt-2 inline-block text-sm md:text-base">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const template = page.template || page.slug

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 pb-4 md:pb-6 border-b border-slate-200 dark:border-slate-800 mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Link
            to="/admin/pages?tab=STATIC"
            className="p-1.5 md:p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[20px] md:text-[24px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-lg md:text-2xl font-bold">정적 페이지 편집</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] md:text-sm mt-0.5 md:mt-1">
              템플릿: <span className="font-mono text-primary">{template}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="px-2.5 md:px-4 py-1.5 md:py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          >
            <option value="DRAFT">임시저장</option>
            <option value="PUBLISHED">공개</option>
          </select>
          <button
            onClick={handleSave}
            disabled={saving || !!parseError}
            className="inline-flex items-center gap-1 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs md:text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-[16px] md:text-[18px]">progress_activity</span>
                <span className="hidden md:inline">저장 중...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px] md:text-[18px]">save</span>
                저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* Title Input */}
      <div className="mb-4 md:mb-6">
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
          페이지 제목
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 md:px-4 py-2 text-xs md:text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          placeholder="페이지 제목을 입력하세요"
        />
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        {/* JSON Editor */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[400px] md:min-h-[600px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-primary text-[18px] md:text-[20px]">code</span>
              <span className="text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300">JSON 콘텐츠</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={formatJson}
                className="px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                포맷팅
              </button>
            </div>
          </div>

          {parseError && (
            <div className="px-3 md:px-4 py-1.5 md:py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
              <p className="text-[10px] md:text-xs text-red-600 dark:text-red-400 font-mono truncate">
                JSON 오류: {parseError}
              </p>
            </div>
          )}

          <textarea
            value={jsonContent}
            onChange={(e) => setJsonContent(e.target.value)}
            className="flex-1 w-full p-3 md:p-4 font-mono text-[10px] md:text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 resize-none focus:outline-none"
            spellCheck={false}
            placeholder="JSON 콘텐츠를 입력하세요..."
          />
        </div>

        {/* Live Preview */}
        <div className="bg-card-light dark:bg-card-dark rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[400px] md:min-h-[600px]">
          <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="material-symbols-outlined text-primary text-[18px] md:text-[20px]">preview</span>
              <span className="text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300">실시간 미리보기</span>
            </div>
            {status === 'PUBLISHED' && (
              <Link
                to={`/${page.slug}`}
                target="_blank"
                className="flex items-center gap-0.5 md:gap-1 px-2 md:px-3 py-0.5 md:py-1 text-[10px] md:text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined text-[12px] md:text-[14px]">open_in_new</span>
                <span className="hidden md:inline">새 탭에서 보기</span>
              </Link>
            )}
          </div>

          <div className="flex-1 overflow-auto p-3 md:p-6 bg-background-light dark:bg-background-dark">
            {parseError ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4">error_outline</span>
                <p className="text-xs md:text-base">JSON 형식이 올바르지 않습니다.</p>
                <p className="text-[10px] md:text-sm mt-1">에디터의 오류를 수정해 주세요.</p>
              </div>
            ) : parsedContent ? (
              template === 'introduce' ? (
                <IntroducePreview content={{ ...defaultIntroduceContent, ...parsedContent }} />
              ) : template === 'privacy' ? (
                <PrivacyPreview content={{ ...defaultPrivacyContent, ...parsedContent }} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4">help_outline</span>
                  <p className="text-xs md:text-base">알 수 없는 템플릿입니다: {template}</p>
                  <p className="text-[10px] md:text-sm mt-1">새 템플릿은 코드로 추가해야 합니다.</p>
                </div>
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="material-symbols-outlined text-[36px] md:text-[48px] mb-3 md:mb-4">article</span>
                <p className="text-xs md:text-base">콘텐츠를 입력해 주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Info */}
      <div className="mt-4 md:mt-6 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg md:rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-2 md:gap-3">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px] md:text-[24px]">info</span>
          <div className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-0.5 md:mb-1">템플릿 정보</p>
            <p className="text-blue-600 dark:text-blue-400 text-[10px] md:text-sm">
              정적 페이지의 레이아웃은 코드에 정의되어 있습니다. 여기서는 JSON 형식의 콘텐츠만 수정할 수 있습니다.
              새로운 레이아웃의 페이지가 필요한 경우 개발자에게 문의하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
