import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

interface Author {
  name: string
  title?: string
  bio?: string
  avatar?: string
  github?: string
  linkedin?: string
}

interface PopularPost {
  id: string
  slug: string
  title: string
  category: {
    name: string
  }
  viewCount: number
}

interface SidebarProps {
  showAuthor?: boolean
  showPopularTopics?: boolean
}

export default function Sidebar({ showAuthor = true, showPopularTopics = true }: SidebarProps) {
  const [author, setAuthor] = useState<Author | null>(null)
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([])

  useEffect(() => {
    // Fetch author info
    const fetchAuthor = async () => {
      try {
        const { data } = await api.getAuthorInfo()
        setAuthor(data)
      } catch {
        // Use default author info
        setAuthor({
          name: 'Jaehyeong',
          title: 'DevOps Engineer',
          bio: '클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 열정을 가진 엔지니어입니다. 배운 것을 기록하고 공유합니다.',
        })
      }
    }

    // Fetch popular posts (PUBLIC only - exclude private posts from ranking)
    const fetchPopularPosts = async () => {
      try {
        const response = await api.getPosts({ limit: 4, sortBy: 'viewCount', status: 'PUBLIC' })
        setPopularPosts(response.posts)
      } catch {
        setPopularPosts([])
      }
    }

    if (showAuthor) fetchAuthor()
    if (showPopularTopics) fetchPopularPosts()
  }, [showAuthor, showPopularTopics])

  const formatViewCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <aside className="lg:col-span-4 space-y-8 sticky top-24 self-start">
      {/* Author Profile Card */}
      {showAuthor && author && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            {author.avatar ? (
              <img
                src={author.avatar}
                alt={author.name}
                className="size-16 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="size-16 rounded-full bg-slate-200 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-slate-400">person</span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-bold">{author.name}</h3>
              {author.title && (
                <p className="text-xs text-primary font-medium">{author.title}</p>
              )}
            </div>
          </div>
          {author.bio && (
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
              {author.bio}
            </p>
          )}
          <div className="flex gap-2">
            {author.github && (
              <a
                href={author.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
              >
                GitHub
              </a>
            )}
            {author.linkedin && (
              <a
                href={author.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
              >
                LinkedIn
              </a>
            )}
            {!author.github && !author.linkedin && (
              <>
                <a
                  href="https://github.com/JaeHeong"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
                >
                  GitHub
                </a>
                <a
                  href="https://www.linkedin.com/in/kjh-qha970301"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold transition-colors text-center"
                >
                  LinkedIn
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* Popular Topics */}
      {showPopularTopics && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
            <h3 className="text-lg font-bold">인기 토픽</h3>
          </div>
          <div className="flex flex-col gap-4">
            {popularPosts.length > 0 ? (
              popularPosts.map((post, index) => (
                <Link
                  key={post.id}
                  to={`/posts/${post.slug}`}
                  className={`group flex items-start gap-3 ${
                    index < popularPosts.length - 1
                      ? 'pb-4 border-b border-slate-100 dark:border-slate-800/50'
                      : ''
                  }`}
                >
                  <span className="text-2xl font-bold text-slate-300 dark:text-slate-700 group-hover:text-primary transition-colors">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors mb-1 line-clamp-2">
                      {post.title}
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      {post.category.name} • {formatViewCount(post.viewCount)} 읽음
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                아직 인기 게시글이 없습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
