import { Router, type IRouter } from 'express'
import { getWeeklyVisitors, getDetailedAnalytics } from '../controllers/analytics.js'
import { authenticate } from '../middleware/auth.js'

export const analyticsRouter: IRouter = Router()

// Public endpoint - no auth required
analyticsRouter.get('/weekly', getWeeklyVisitors)

// Admin only - detailed analytics
analyticsRouter.get('/detailed', authenticate, getDetailedAnalytics)
