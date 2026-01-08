import { Router, type IRouter } from 'express'
import { getWeeklyVisitors } from '../controllers/analytics.js'

export const analyticsRouter: IRouter = Router()

// Public endpoint - no auth required
analyticsRouter.get('/weekly', getWeeklyVisitors)
