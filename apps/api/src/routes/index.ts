import { Router, type IRouter } from 'express'
import { postRouter } from './posts.js'
import { categoryRouter } from './categories.js'
import { tagRouter } from './tags.js'
import { authRouter } from './auth.js'
import { uploadRouter } from './upload.js'
import { metadataRouter } from './metadata.js'
import { authorRouter } from './author.js'
import { pageRouter } from './pages.js'

export const apiRouter: IRouter = Router()

apiRouter.use('/posts', postRouter)
apiRouter.use('/categories', categoryRouter)
apiRouter.use('/tags', tagRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/upload', uploadRouter)
apiRouter.use('/metadata', metadataRouter)
apiRouter.use('/author', authorRouter)
apiRouter.use('/pages', pageRouter)

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
    },
  })
})
