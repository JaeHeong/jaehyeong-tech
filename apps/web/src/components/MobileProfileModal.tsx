import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import api, { Tag } from '../services/api'

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

const LIKE_WEIGHT = 5
const calculateScore = (post: PopularPost) => (post.likeCount * LIKE_WEIGHT) + post.viewCount

export default function MobileProfileModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [author, setAuthor] = useState<Author | null>(null)
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const modalRef = useRef<HTMLDivElement>(null)

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsOpen(false)
      setIsClosing(false)
    }, 200)
  }

  const handleOpen = () => {
    setIsOpen(true)
  }

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const { data } = await api.getAuthorInfo()
        setAuthor(data)
      } catch {
        setAuthor({
          name: 'Jaehyeong',
          title: 'DevOps Engineer',
          bio: '클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 열정을 가진 엔지니어입니다. 배운 것을 기록하고 공유합니다.',
        })
      }
    }

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

    const fetchTags = async () => {
      try {
        const response = await api.getTags()
        const sortedTags = response.tags
          .filter((tag) => tag.postCount > 0)
          .sort((a, b) => b.postCount - a.postCount)
        setTags(sortedTags)
      } catch {
        setTags([])
      }
    }

    fetchAuthor()
    fetchPopularPosts()
    fetchTags()
  }, [])

  const formatViewCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toString()
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Floating Action Button - Mobile Only */}
      <button
        onClick={handleOpen}
        className="lg:hidden fixed bottom-6 right-6 z-40 size-14 rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-blue-600 transition-all hover:scale-105 active:scale-95 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-800"
        aria-label="프로필 보기"
      >
        {author?.avatar ? (
          <img
            src={author.avatar}
            alt={author.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="material-symbols-outlined text-white text-2xl">person</span>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
              isClosing ? 'opacity-0' : 'opacity-100'
            }`}
            onClick={handleClose}
          />

          {/* Modal Content */}
          <div
            ref={modalRef}
            className={`relative bg-card-light dark:bg-card-dark rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto border border-slate-200 dark:border-slate-800 transition-all duration-200 ${
              isClosing
                ? 'opacity-0 scale-95'
                : 'opacity-100 scale-100'
            }`}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 p-1 transition-all hover:scale-110 active:scale-95 z-10"
              aria-label="닫기"
            >
              <span className="material-symbols-outlined text-[20px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">close</span>
            </button>

            <div className="p-6 space-y-6">
              {/* Author Profile Card */}
              {author && (
                <div>
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
                    <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 leading-relaxed">
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

              {/* Divider */}
              <div className="border-t border-slate-200 dark:border-slate-800" />

              {/* Popular Topics */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                  <h3 className="text-lg font-bold">인기 토픽</h3>
                </div>
                <div className="flex flex-col gap-3">
                  {popularPosts.length > 0 ? (
                    popularPosts.map((post, index) => (
                      <Link
                        key={post.id}
                        to={`/posts/${post.slug}`}
                        onClick={handleClose}
                        className={`group flex items-start gap-3 ${
                          index < popularPosts.length - 1
                            ? 'pb-3 border-b border-slate-100 dark:border-slate-800/50'
                            : ''
                        }`}
                      >
                        <span className="text-xl font-bold text-slate-300 dark:text-slate-700 group-hover:text-primary transition-colors">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm leading-snug group-hover:text-primary transition-colors mb-1 line-clamp-2">
                            {post.title}
                          </h4>
                          <span className="text-xs text-slate-500">
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

              {/* Tags */}
              {tags.length > 0 && (
                <>
                  <div className="border-t border-slate-200 dark:border-slate-800" />
                  <div>
                    <div className="flex items-center gap-3 mb-4">
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
                          onClick={handleClose}
                          className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-400 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          #{tag.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
