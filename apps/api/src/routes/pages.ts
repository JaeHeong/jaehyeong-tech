import { Router, type IRouter } from 'express'
import * as pageController from '../controllers/pages.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'

export const pageRouter: IRouter = Router()

// Public routes
pageRouter.get('/', pageController.getPages)
pageRouter.get('/notices', pageController.getNotices)
pageRouter.get('/slug/:slug', optionalAuth, pageController.getPageBySlug)

// Admin routes
pageRouter.get('/admin', authenticate, pageController.getAllPagesAdmin)
pageRouter.get('/admin/stats', authenticate, pageController.getPageStats)
pageRouter.get('/admin/:id', authenticate, pageController.getPageById)
pageRouter.post('/', authenticate, pageController.createPage)
pageRouter.put('/:id', authenticate, pageController.updatePage)
pageRouter.delete('/:id', authenticate, pageController.deletePage)
