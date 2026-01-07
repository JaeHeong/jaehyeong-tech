import { Router, type IRouter } from 'express'
import * as categoryController from '../controllers/categories.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'
import { validateBody, validateParams } from '../validation/middleware.js'
import { createCategorySchema, updateCategorySchema, idParamSchema } from '../validation/schemas.js'

export const categoryRouter: IRouter = Router()

// Public routes (with optional auth for admin features)
categoryRouter.get('/', optionalAuth, categoryController.getCategories)
categoryRouter.get('/:slug', optionalAuth, categoryController.getCategoryBySlug)
categoryRouter.get('/:slug/posts', optionalAuth, categoryController.getCategoryPosts)

// Protected routes
categoryRouter.post('/', authenticate, validateBody(createCategorySchema), categoryController.createCategory)
categoryRouter.put('/:id', authenticate, validateParams(idParamSchema), validateBody(updateCategorySchema), categoryController.updateCategory)
categoryRouter.delete('/:id', authenticate, validateParams(idParamSchema), categoryController.deleteCategory)
