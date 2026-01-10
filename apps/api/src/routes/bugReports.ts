import { Router, type IRouter } from 'express'
import {
  createBugReport,
  getPublicBugReports,
  getPublicBugReport,
  getBugReports,
  getBugReport,
  updateBugReportStatus,
  updateBugReport,
  deleteBugReport,
} from '../controllers/bugReports.js'
import { authenticate } from '../middleware/auth.js'

export const bugReportRouter: IRouter = Router()

// Public routes
bugReportRouter.post('/', createBugReport)
bugReportRouter.get('/public', getPublicBugReports)  // Public list (no sensitive info)
bugReportRouter.get('/public/:id', getPublicBugReport)  // Public detail (no sensitive info)

// Admin routes
bugReportRouter.get('/', authenticate, getBugReports)
bugReportRouter.get('/:id', authenticate, getBugReport)
bugReportRouter.patch('/:id/status', authenticate, updateBugReportStatus)
bugReportRouter.patch('/:id', authenticate, updateBugReport)
bugReportRouter.delete('/:id', authenticate, deleteBugReport)
