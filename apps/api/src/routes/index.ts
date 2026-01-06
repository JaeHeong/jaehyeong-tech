import { Router, type IRouter } from 'express'
import { postRouter } from './posts.js'
import { categoryRouter } from './categories.js'
import { tagRouter } from './tags.js'
import { authRouter } from './auth.js'
import { uploadRouter } from './upload.js'

export const apiRouter: IRouter = Router()

apiRouter.use('/posts', postRouter)
apiRouter.use('/categories', categoryRouter)
apiRouter.use('/tags', tagRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/upload', uploadRouter)

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
    },
  })
})
