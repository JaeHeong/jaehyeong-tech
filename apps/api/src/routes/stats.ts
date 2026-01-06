import { Router, type IRouter } from 'express'
import * as statsController from '../controllers/stats.js'
import { authenticate } from '../middleware/auth.js'

export const statsRouter: IRouter = Router()

// Protected routes (admin only)
statsRouter.get('/dashboard', authenticate, statsController.getDashboardStats)
