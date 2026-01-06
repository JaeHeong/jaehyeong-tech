import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type Post } from '../services/api'

export default function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    setIsLoading(true)
    api.getPost(slug)
      .then(({ post }) => {
        setPost(post)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '게시글을 불러오는데 실패했습니다.')
      })
      .finally(() => setIsLoading(false))
  }, [slug])

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-primary">
            progress_activity
          </span>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <article className="bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="w-full h-64 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-[64px] text-slate-300 dark:text-slate-600">
                error
              </span>
            </div>
            <div className="p-6 md:p-10">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                게시글을 찾을 수 없습니다
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8">
                {error || '요청하신 게시글이 존재하지 않거나 삭제되었습니다.'}
              </p>
              <Link to="/posts" className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors">
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                글 목록으로 돌아가기
              </Link>
            </div>
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Post Content Styles */}
      <style>{`
        .post-content pre {
          position: relative;
          margin: 1.5rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
          background: linear-gradient(180deg, #f1f5f9 0%, #f1f5f9 32px, #f8fafc 32px);
          padding: 0;
        }
        .dark .post-content pre {
          border-color: #30363d;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
          background: linear-gradient(180deg, #21262d 0%, #21262d 32px, #0d1117 32px);
        }
        .post-content pre::before {
          content: '';
          display: block;
          height: 32px;
          background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
          border-bottom: 1px solid #e2e8f0;
          position: relative;
        }
        .dark .post-content pre::before {
          background: linear-gradient(180deg, #21262d 0%, #161b22 100%);
          border-bottom-color: #30363d;
        }
        .post-content pre::after {
          content: '';
          position: absolute;
          top: 10px;
          left: 12px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #ff5f57;
          box-shadow: 18px 0 0 #ffbd2e, 36px 0 0 #28c840;
        }
        .post-content pre code {
          display: block;
          padding: 1rem;
          background: transparent;
          color: #1e293b;
          overflow-x: auto;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 0.875rem;
          line-height: 1.6;
        }
        .dark .post-content pre code {
          color: #e6edf3;
        }
        /* Inline code */
        .post-content code:not(pre code) {
          background: #f1f5f9;
          padding: 0.125rem 0.375rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          font-family: 'SF Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
          color: #dc2626;
        }
        .dark .post-content code:not(pre code) {
          background: #1e293b;
          color: #f87171;
        }
        /* Syntax highlighting */
        .post-content .hljs-keyword,
        .post-content .hljs-selector-tag,
        .post-content .hljs-built_in { color: #a855f7; }
        .post-content .hljs-string,
        .post-content .hljs-attr { color: #22c55e; }
        .post-content .hljs-comment { color: #94a3b8; font-style: italic; }
        .post-content .hljs-function,
        .post-content .hljs-title { color: #3b82f6; }
        .post-content .hljs-number { color: #f59e0b; }
        .post-content .hljs-variable,
        .post-content .hljs-template-variable { color: #ef4444; }
        .post-content .hljs-property { color: #0891b2; }
        .dark .post-content .hljs-keyword,
        .dark .post-content .hljs-selector-tag,
        .dark .post-content .hljs-built_in { color: #c084fc; }
        .dark .post-content .hljs-string,
        .dark .post-content .hljs-attr { color: #4ade80; }
        .dark .post-content .hljs-comment { color: #64748b; }
        .dark .post-content .hljs-function,
        .dark .post-content .hljs-title { color: #60a5fa; }
        .dark .post-content .hljs-number { color: #fbbf24; }
        .dark .post-content .hljs-variable,
        .dark .post-content .hljs-template-variable { color: #f87171; }
        .dark .post-content .hljs-property { color: #22d3ee; }
        /* Blockquote */
        .post-content blockquote {
          border-left: 4px solid #3182f6;
          background: rgba(49, 130, 246, 0.05);
          padding: 1.5rem;
          border-radius: 0 0.5rem 0.5rem 0;
          margin: 2rem 0;
          font-style: italic;
          color: #475569;
        }
        .dark .post-content blockquote {
          background: rgba(49, 130, 246, 0.1);
          color: #94a3b8;
        }
        /* YouTube */
        .post-content div[data-youtube-video] {
          width: 100%;
          max-width: 100%;
          margin: 1.5rem 0;
          border-radius: 0.75rem;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .post-content div[data-youtube-video] iframe {
          width: 100%;
          aspect-ratio: 16 / 9;
          border: none;
        }
        /* Images */
        .post-content img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin: 1.5rem 0;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        /* Links */
        .post-content a {
          color: #3182f6;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .post-content a:hover {
          color: #1d4ed8;
        }
        /* Lists */
        .post-content ul,
        .post-content ol {
          padding-left: 1.5rem;
          margin: 1rem 0;
        }
        .post-content ul { list-style-type: disc; }
        .post-content ol { list-style-type: decimal; }
        .post-content li { margin: 0.5rem 0; }
        .post-content li::marker { color: #3182f6; }
        /* Headings */
        .post-content h1 { font-size: 2rem; font-weight: 700; margin: 2.5rem 0 1rem; color: inherit; }
        .post-content h2 { font-size: 1.5rem; font-weight: 700; margin: 2rem 0 1rem; color: inherit; }
        .post-content h3 { font-size: 1.25rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: inherit; }
        /* Paragraphs */
        .post-content p { margin: 1rem 0; line-height: 1.8; }
        .post-content p:first-child { font-size: 1.125rem; }
        /* Strong */
        .post-content strong { font-weight: 600; }
      `}</style>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content */}
        <main className="lg:col-span-8 flex flex-col gap-8">
          <article className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Cover Image */}
            {post.coverImage ? (
              <div
                className="w-full h-64 md:h-96 bg-cover bg-center"
                style={{ backgroundImage: `url('${post.coverImage}')` }}
              />
            ) : (
              <div className="w-full h-64 md:h-96 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <span className="material-symbols-outlined text-[64px] text-primary/30">
                  article
                </span>
              </div>
            )}

            <div className="p-6 md:p-10">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
                <Link to="/" className="hover:text-primary transition-colors">홈</Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <Link to={`/categories/${post.category.slug}`} className="hover:text-primary transition-colors">
                  {post.category.name}
                </Link>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                <span className="text-primary font-medium truncate max-w-[200px]">{post.title}</span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
                {post.title}
              </h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-6 pb-8 border-b border-slate-100 dark:border-slate-800 mb-8">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {post.author.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{post.author.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Author</div>
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                  {new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  {post.readingTime}분 소요
                </div>
              </div>

              {/* Content */}
              <div
                className="post-content text-slate-700 dark:text-slate-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />

              {/* Tags */}
              <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/tags/${tag.slug}`}
                      className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex items-center justify-between">
                <div className="flex gap-4">
                  <button className="flex items-center gap-2 text-slate-500 hover:text-red-500 transition-colors">
                    <span className="material-symbols-outlined text-[20px]">favorite</span>
                    <span className="text-sm font-medium">{post.likeCount > 0 ? post.likeCount : '좋아요'}</span>
                  </button>
                  <button className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">share</span>
                    <span className="text-sm font-medium">공유하기</span>
                  </button>
                </div>
                <button className="text-slate-500 hover:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">bookmark</span>
                </button>
              </div>
            </div>
          </article>

          {/* Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/posts"
              className="group block p-6 bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-all"
            >
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 block">이전 글</span>
              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                글 목록으로 돌아가기
              </h4>
            </Link>
            <div className="hidden md:block" />
          </div>
        </main>

        {/* Sidebar */}
        <aside className="lg:col-span-4 space-y-8">
          {/* Author Card */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                {post.author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold">{post.author.name}</h3>
                <p className="text-xs text-primary font-medium">Author</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 열정을 가진 엔지니어입니다.
            </p>
            <div className="flex gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
              >
                Github
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
              >
                Twitter
              </a>
            </div>
          </div>

          {/* Category Info */}
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm sticky top-24">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined">category</span>
              </div>
              <h3 className="text-lg font-bold">카테고리</h3>
            </div>
            <Link
              to={`/categories/${post.category.slug}`}
              className="block p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-primary/5 transition-colors"
            >
              <h4 className="font-bold text-slate-900 dark:text-white mb-1">{post.category.name}</h4>
              <p className="text-sm text-slate-500">이 카테고리의 다른 글 보기</p>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
