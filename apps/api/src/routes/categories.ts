import { Router, type IRouter } from 'express'
import * as categoryController from '../controllers/categories.js'
import { authenticate } from '../middleware/auth.js'
import { validateBody, validateParams } from '../validation/middleware.js'
import { createCategorySchema, updateCategorySchema, idParamSchema } from '../validation/schemas.js'

export const categoryRouter: IRouter = Router()

// Public routes
categoryRouter.get('/', categoryController.getCategories)
categoryRouter.get('/:slug', categoryController.getCategoryBySlug)
categoryRouter.get('/:slug/posts', categoryController.getCategoryPosts)

// Protected routes
categoryRouter.post('/', authenticate, validateBody(createCategorySchema), categoryController.createCategory)
categoryRouter.put('/:id', authenticate, validateParams(idParamSchema), validateBody(updateCategorySchema), categoryController.updateCategory)
categoryRouter.delete('/:id', authenticate, validateParams(idParamSchema), categoryController.deleteCategory)
