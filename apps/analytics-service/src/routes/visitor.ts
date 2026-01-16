import { Router, IRouter } from 'express';
import * as visitorController from '../controllers/visitor';
import { resolveTenant } from '../middleware/tenantResolver';
import { requireAdmin } from '../middleware/authenticate';

export const visitorRouter: IRouter = Router();

// Apply tenant resolution to all routes
visitorRouter.use(resolveTenant);

// Public routes
visitorRouter.post('/track', visitorController.trackVisitor);
visitorRouter.get('/stats', visitorController.getVisitorStats);

// Admin routes
visitorRouter.get('/admin/stats', requireAdmin, visitorController.getDetailedVisitorStats);
