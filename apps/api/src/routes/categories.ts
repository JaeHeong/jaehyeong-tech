import { Router, type IRouter } from 'express'
import * as categoryController from '../controllers/categories.js'
import { authenticate } from '../middleware/auth.js'

export const categoryRouter: IRouter = Router()

// Public routes
categoryRouter.get('/', categoryController.getCategories)
categoryRouter.get('/:slug', categoryController.getCategoryBySlug)
categoryRouter.get('/:slug/posts', categoryController.getCategoryPosts)

// Protected routes
categoryRouter.post('/', authenticate, categoryController.createCategory)
categoryRouter.put('/:id', authenticate, categoryController.updateCategory)
categoryRouter.delete('/:id', authenticate, categoryController.deleteCategory)
