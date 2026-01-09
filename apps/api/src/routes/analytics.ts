import { Router, type IRouter } from 'express'
import { getWeeklyVisitors, getDetailedAnalytics, getPageAnalytics } from '../controllers/analytics.js'
import { authenticate } from '../middleware/auth.js'

export const analyticsRouter: IRouter = Router()

// Public endpoint - no auth required
analyticsRouter.get('/weekly', getWeeklyVisitors)

// Admin only - detailed analytics
analyticsRouter.get('/detailed', authenticate, getDetailedAnalytics)

// Admin only - page-specific analytics
analyticsRouter.get('/page', authenticate, getPageAnalytics)
