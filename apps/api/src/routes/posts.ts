import { Router, type IRouter } from 'express'
import * as postController from '../controllers/posts.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'

export const postRouter: IRouter = Router()

// Public routes
postRouter.get('/', postController.getPosts)
postRouter.get('/featured', postController.getFeaturedPosts)
postRouter.get('/:slug', optionalAuth, postController.getPostBySlug)

// Protected routes
postRouter.post('/', authenticate, postController.createPost)
postRouter.put('/:id', authenticate, postController.updatePost)
postRouter.delete('/:id', authenticate, postController.deletePost)
postRouter.post('/:id/like', postController.likePost)
