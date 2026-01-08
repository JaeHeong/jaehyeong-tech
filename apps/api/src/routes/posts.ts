import { Router, type IRouter } from 'express'
import * as postController from '../controllers/posts.js'
import { toggleLike, checkLikeStatus } from '../controllers/likes.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'
import { validateBody, validateQuery, validateParams } from '../validation/middleware.js'
import { createPostSchema, updatePostSchema, postQuerySchema, idParamSchema, bulkDeleteSchema } from '../validation/schemas.js'

export const postRouter: IRouter = Router()

// Public routes (optionalAuth to check if user is admin for draft access)
postRouter.get('/', optionalAuth, validateQuery(postQuerySchema), postController.getPosts)
postRouter.get('/featured', postController.getFeaturedPosts)
postRouter.get('/top-viewed', postController.getTopViewedPost)
postRouter.get('/admin/:id', authenticate, validateParams(idParamSchema), postController.getPostById)
postRouter.get('/:slug', optionalAuth, postController.getPostBySlug)
postRouter.get('/:slug/adjacent', postController.getAdjacentPosts)
postRouter.get('/:slug/related', postController.getRelatedPosts)

// Protected routes
postRouter.post('/', authenticate, validateBody(createPostSchema), postController.createPost)
postRouter.post('/bulk-delete', authenticate, validateBody(bulkDeleteSchema), postController.bulkDeletePosts)
postRouter.put('/:id', authenticate, validateParams(idParamSchema), validateBody(updatePostSchema), postController.updatePost)
postRouter.delete('/:id', authenticate, validateParams(idParamSchema), postController.deletePost)

// Like routes (public, uses IP-based tracking)
postRouter.post('/:id/like', validateParams(idParamSchema), toggleLike)
postRouter.get('/:id/like', validateParams(idParamSchema), checkLikeStatus)
