import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { Tag, WeeklyVisitorsResponse, RecentComment, VisitorStats } from '../services/api'

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
  likeCount: number
}

// Same scoring formula as featured post: 1 like = 5 views
const LIKE_WEIGHT = 5
const calculateScore = (post: PopularPost) => (post.likeCount * LIKE_WEIGHT) + post.viewCount

interface SidebarProps {
  showAuthor?: boolean
  showPopularTopics?: boolean
  showTags?: boolean
  showVisitors?: boolean
  showRecentComments?: boolean
}

export default function Sidebar({ showAuthor = true, showPopularTopics = true, showTags = true, showVisitors = true, showRecentComments = true }: SidebarProps) {
  const [author, setAuthor] = useState<Author | null>(null)
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [visitors, setVisitors] = useState<WeeklyVisitorsResponse | null>(null)
  const [recentComments, setRecentComments] = useState<RecentComment[]>([])
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null)

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
    // Sort by score (likeCount * 10 + viewCount) same as featured post
    const fetchPopularPosts = async () => {
      try {
        const response = await api.getPosts({ limit: 20, status: 'PUBLIC' })
        const sorted = response.posts
          .sort((a, b) => calculateScore(b) - calculateScore(a))
          .slice(0, 4)
        setPopularPosts(sorted)
      } catch {
        setPopularPosts([])
      }
    }

    // Fetch all tags sorted by post count
    const fetchTags = async () => {
      try {
        const response = await api.getTags()
        // Sort by post count (descending) and filter out tags with no posts
        const sortedTags = response.tags
          .filter((tag) => tag.postCount > 0)
          .sort((a, b) => b.postCount - a.postCount)
        setTags(sortedTags)
      } catch {
        setTags([])
      }
    }

    // Fetch weekly visitors
    const fetchVisitors = async () => {
      try {
        const data = await api.getWeeklyVisitors()
        setVisitors(data)
      } catch {
        setVisitors(null)
      }
    }

    // Fetch recent comments
    const fetchRecentComments = async () => {
      try {
        const data = await api.getRecentComments(3)
        setRecentComments(data)
      } catch {
        setRecentComments([])
      }
    }

    // Fetch visitor stats (IP hash based)
    const fetchVisitorStats = async () => {
      try {
        const data = await api.getVisitorStats()
        setVisitorStats(data)
      } catch {
        setVisitorStats(null)
      }
    }

    if (showAuthor) fetchAuthor()
    if (showPopularTopics) {
      fetchPopularPosts()
      fetchVisitorStats()
    }
    if (showTags) fetchTags()
    if (showVisitors) fetchVisitors()
    if (showRecentComments) fetchRecentComments()
  }, [showAuthor, showPopularTopics, showTags, showVisitors, showRecentComments])

  const formatViewCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  return (
    <aside className="hidden lg:block lg:col-span-4 space-y-8 sticky top-24 self-start">
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

          {/* Visitor Stats */}
          {visitorStats && (
            <div className="mb-5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="text-center mb-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">Total</span>
                <p className="text-2xl font-bold text-primary">{visitorStats.total.toLocaleString()}</p>
              </div>
              <div className="flex justify-center gap-6 text-xs">
                <div className="text-center">
                  <span className="text-slate-500 dark:text-slate-400">Today</span>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{visitorStats.today}</p>
                </div>
                <div className="text-center">
                  <span className="text-slate-500 dark:text-slate-400">Yesterday</span>
                  <p className="font-bold text-slate-700 dark:text-slate-300">{visitorStats.yesterday}</p>
                </div>
              </div>
            </div>
          )}

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
                      {post.category.name} • {formatViewCount(post.viewCount)} 읽음 • {post.likeCount} 좋아요
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

          {/* Note at bottom */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50">
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              ※ 좋아요·조회수 기반
            </span>
          </div>
        </div>
      )}

      {/* Recent Comments */}
      {showRecentComments && recentComments.length > 0 && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <span className="material-symbols-outlined">chat</span>
            </div>
            <h3 className="text-lg font-bold">최근 댓글</h3>
          </div>
          <div className="flex flex-col gap-4">
            {recentComments.map((comment, index) => (
              <Link
                key={comment.id}
                to={`/posts/${comment.post.slug}`}
                className={`group ${
                  index < recentComments.length - 1
                    ? 'pb-4 border-b border-slate-100 dark:border-slate-800/50'
                    : ''
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {comment.authorAvatar ? (
                    <img
                      src={comment.authorAvatar}
                      alt={comment.authorName}
                      className="size-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[14px] text-slate-400">person</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {comment.authorName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed group-hover:text-primary transition-colors">
                      {comment.content}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 truncate group-hover:text-primary/70 transition-colors">
                      <span className="material-symbols-outlined text-[10px] align-middle mr-0.5">arrow_forward</span>
                      {comment.post.title}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {showTags && tags.length > 0 && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
              <span className="material-symbols-outlined">sell</span>
            </div>
            <h3 className="text-lg font-bold">태그</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/search?q=${encodeURIComponent(tag.name)}`}
                className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Visitors */}
      {showVisitors && visitors && visitors.configured && visitors.daily.length > 0 && (
        <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <span className="material-symbols-outlined">analytics</span>
              </div>
              <h3 className="text-lg font-bold">주간 방문자</h3>
            </div>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              최근 7일
            </span>
          </div>

          {/* Bar Chart */}
          <div className="flex items-end justify-between gap-1 h-28 mb-4">
            {visitors.daily.map((day, index) => {
              const maxVisitors = Math.max(...visitors.daily.map((d) => d.visitors), 1)
              const heightPercent = (day.visitors / maxVisitors) * 100
              const opacity = 0.2 + (index / (visitors.daily.length - 1)) * 0.8
              const isToday = index === visitors.daily.length - 1
              const dayLabel = new Date(day.date).toLocaleDateString('ko-KR', { weekday: 'short' }).charAt(0)

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {day.visitors}
                  </span>
                  <div className="w-full flex items-end justify-center h-16">
                    <div
                      className="w-full max-w-[24px] rounded-t transition-all duration-300 group-hover:opacity-100 cursor-default"
                      style={{
                        height: `${Math.max(heightPercent, 4)}%`,
                        backgroundColor: `rgba(49, 130, 246, ${opacity})`,
                      }}
                      title={`${day.date}: ${day.visitors}명`}
                    />
                  </div>
                  <span className={`text-[10px] ${isToday ? 'text-primary font-bold' : 'text-slate-400'}`}>
                    {dayLabel}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400">총 </span>
              <span className="font-bold text-primary">{visitors.total.toLocaleString()}</span>
              <span className="text-slate-500 dark:text-slate-400">명</span>
            </div>
            {visitors.daily.length > 0 && (
              <div className="text-slate-400 dark:text-slate-500 text-xs">
                오늘 {visitors.daily[visitors.daily.length - 1]?.visitors || 0}명
              </div>
            )}
          </div>

          {/* Update time */}
          {visitors.updatedAt && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-right">
              {visitors.stale && '⚠️ '}
              업데이트: {new Date(visitors.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </aside>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '방금'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
