import { Router, type IRouter } from 'express'
import * as commentController from '../controllers/comments.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'
import { validateBody, validateParams } from '../validation/middleware.js'
import { createCommentSchema, updateCommentSchema, idParamSchema } from '../validation/schemas.js'

export const commentRouter: IRouter = Router()

// Public routes (with optional auth for visibility filtering)
commentRouter.get('/post/:postId', optionalAuth, commentController.getComments)

// Create comment (optional auth - can be anonymous)
commentRouter.post(
  '/post/:postId',
  optionalAuth,
  validateBody(createCommentSchema),
  commentController.createComment
)

// Update/Delete comment (optional auth - checks password for anonymous)
commentRouter.put(
  '/:id',
  optionalAuth,
  validateParams(idParamSchema),
  validateBody(updateCommentSchema),
  commentController.updateComment
)

commentRouter.delete(
  '/:id',
  optionalAuth,
  validateParams(idParamSchema),
  commentController.deleteComment
)

// Admin routes
commentRouter.get('/admin', authenticate, commentController.getAllComments)
commentRouter.delete('/admin/:id', authenticate, validateParams(idParamSchema), commentController.adminDeleteComment)
