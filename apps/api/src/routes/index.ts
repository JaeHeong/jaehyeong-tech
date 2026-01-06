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
import { commentRouter } from './comments.js'
import { statsRouter } from './stats.js'

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
apiRouter.use('/comments', commentRouter)
apiRouter.use('/stats', statsRouter)

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
      comments: '/api/comments',
      stats: '/api/stats',
    },
  })
})
