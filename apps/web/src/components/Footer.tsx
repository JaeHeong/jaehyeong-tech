import { Link } from 'react-router-dom'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 py-10 mt-12 bg-card-light dark:bg-card-dark">
      <div className="container-wrapper flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          © {currentYear} jaehyeong tech. All rights reserved.
        </p>
        <div className="flex gap-6">
          <Link
            to="/rss"
            className="text-slate-400 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">rss_feed</span>
          </Link>
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors"
          >
            Twitter
          </a>
          <a
            href="https://github.com/JaeHeong"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-primary transition-colors"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  )
}
