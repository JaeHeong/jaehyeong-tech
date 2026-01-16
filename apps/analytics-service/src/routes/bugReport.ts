import { Router } from 'express';
import * as bugReportController from '../controllers/bugReport';
import { resolveTenant } from '../middleware/tenantResolver';
import { requireAdmin } from '../middleware/authenticate';

export const bugReportRouter = Router();

// Apply tenant resolution to all routes
bugReportRouter.use(resolveTenant);

// Public routes
bugReportRouter.post('/', bugReportController.createBugReport);
bugReportRouter.get('/public', bugReportController.getPublicBugReports);
bugReportRouter.get('/public/:id', bugReportController.getPublicBugReport);

// Admin routes
bugReportRouter.get('/admin', requireAdmin, bugReportController.getBugReports);
bugReportRouter.get('/admin/:id', requireAdmin, bugReportController.getBugReport);
bugReportRouter.put('/admin/:id', requireAdmin, bugReportController.updateBugReport);
bugReportRouter.delete('/admin/:id', requireAdmin, bugReportController.deleteBugReport);
