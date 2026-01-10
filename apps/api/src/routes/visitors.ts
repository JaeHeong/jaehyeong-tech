import { Router, type IRouter } from 'express'
import { trackVisitor, getVisitorStats } from '../controllers/visitors.js'

export const visitorsRouter: IRouter = Router()

// Track a visitor (public endpoint)
visitorsRouter.post('/track', trackVisitor)

// Get visitor stats (public endpoint)
visitorsRouter.get('/stats', getVisitorStats)
