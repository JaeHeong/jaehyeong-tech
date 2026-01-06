import { Router, type IRouter } from 'express'
import * as tagController from '../controllers/tags.js'
import { authenticate } from '../middleware/auth.js'

export const tagRouter: IRouter = Router()

// Public routes
tagRouter.get('/', tagController.getTags)
tagRouter.get('/:slug', tagController.getTagBySlug)
tagRouter.get('/:slug/posts', tagController.getTagPosts)

// Protected routes (admin only)
tagRouter.post('/', authenticate, tagController.createTag)
tagRouter.put('/:id', authenticate, tagController.updateTag)
tagRouter.delete('/:id', authenticate, tagController.deleteTag)
