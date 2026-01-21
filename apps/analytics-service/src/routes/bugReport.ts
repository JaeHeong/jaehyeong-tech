import { Router, IRouter } from 'express';
import * as bugReportController from '../controllers/bugReport';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

export const bugReportRouter: IRouter = Router();

// Apply tenant resolution to all routes
bugReportRouter.use(resolveTenant);

// Public routes
bugReportRouter.post('/', bugReportController.createBugReport);
bugReportRouter.get('/public', bugReportController.getPublicBugReports);
bugReportRouter.get('/public/:id', bugReportController.getPublicBugReport);

// Admin routes (authenticate -> requireAdmin)
bugReportRouter.get('/admin', authenticate, requireAdmin, bugReportController.getBugReports);
bugReportRouter.get('/admin/:id', authenticate, requireAdmin, bugReportController.getBugReport);
bugReportRouter.put('/admin/:id', authenticate, requireAdmin, bugReportController.updateBugReport);
bugReportRouter.delete('/admin/:id', authenticate, requireAdmin, bugReportController.deleteBugReport);
