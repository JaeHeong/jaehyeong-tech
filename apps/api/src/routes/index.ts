import { Router, type IRouter } from 'express'
import { postRouter } from './posts.js'
import { categoryRouter } from './categories.js'
import { tagRouter } from './tags.js'
import { authRouter } from './auth.js'
import { uploadRouter } from './upload.js'
import { metadataRouter } from './metadata.js'
import { authorRouter } from './author.js'
import { pageRouter } from './pages.js'
import { backupRouter } from './backup.js'
import { imageRouter } from './images.js'
import { likeRouter } from './likes.js'
import { bookmarkRouter } from './bookmarks.js'
import { commentRouter } from './comments.js'
import { statsRouter } from './stats.js'
import { draftRouter } from './drafts.js'
import { analyticsRouter } from './analytics.js'
import { usersRouter } from './users.js'
import { bugReportRouter } from './bugReports.js'

export const apiRouter: IRouter = Router()

apiRouter.use('/posts', postRouter)
apiRouter.use('/categories', categoryRouter)
apiRouter.use('/tags', tagRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/upload', uploadRouter)
apiRouter.use('/metadata', metadataRouter)
apiRouter.use('/author', authorRouter)
apiRouter.use('/pages', pageRouter)
apiRouter.use('/backups', backupRouter)
apiRouter.use('/images', imageRouter)
apiRouter.use('/likes', likeRouter)
apiRouter.use('/bookmarks', bookmarkRouter)
apiRouter.use('/comments', commentRouter)
apiRouter.use('/stats', statsRouter)
apiRouter.use('/drafts', draftRouter)
apiRouter.use('/analytics', analyticsRouter)
apiRouter.use('/users', usersRouter)
apiRouter.use('/bug-reports', bugReportRouter)

// API info
apiRouter.get('/', (_req, res) => {
  res.json({
    name: 'Jaehyeong Tech Blog API',
    version: '0.1.0',
    endpoints: {
      posts: '/api/posts',
      categories: '/api/categories',
      tags: '/api/tags',
      auth: '/api/auth',
      metadata: '/api/metadata',
      author: '/api/author',
      pages: '/api/pages',
      backups: '/api/backups',
      images: '/api/images',
      likes: '/api/likes',
      bookmarks: '/api/bookmarks',
      comments: '/api/comments',
      stats: '/api/stats',
      drafts: '/api/drafts',
      analytics: '/api/analytics',
      users: '/api/users',
      bugReports: '/api/bug-reports',
    },
  })
})
