import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

interface Author {
  github?: string
  linkedin?: string
  twitter?: string // Used for "구 블로그"
}

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const [author, setAuthor] = useState<Author | null>(null)

  useEffect(() => {
    const fetchAuthor = async () => {
      try {
        const { data } = await api.getAuthorInfo()
        setAuthor(data)
      } catch {
        // Use defaults if API fails
        setAuthor(null)
      }
    }
    fetchAuthor()
  }, [])

  // Default links if author data not available
  const github = author?.github || 'https://github.com/JaeHeong'
  const linkedin = author?.linkedin || 'https://www.linkedin.com/in/kjh-qha970301'
  const oldBlog = author?.twitter || 'https://jaehyeong.tistory.com/'

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-6 md:py-10 mt-8 md:mt-12 bg-card-light dark:bg-card-dark">
      <div className="container-wrapper flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm">
            © {currentYear} jaehyeong tech. All rights reserved.
          </p>
          <Link
            to="/privacy"
            className="text-slate-400 hover:text-primary transition-colors text-xs md:text-sm"
          >
            개인정보처리방침
          </Link>
        </div>
        <div className="flex gap-4 md:gap-6">
          <a
            href="/rss.xml"
            className="text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] md:text-[24px]">rss_feed</span>
          </a>
          <a
            href={oldBlog}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors text-xs md:text-sm"
          >
            구 블로그
          </a>
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors text-xs md:text-sm"
          >
            GitHub
          </a>
          <a
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors text-xs md:text-sm"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  )
}
