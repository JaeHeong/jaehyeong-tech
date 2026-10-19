import { Router, IRouter } from 'express';
import * as visitorController from '../controllers/visitor';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

export const visitorRouter: IRouter = Router();

// Apply tenant resolution to all routes
visitorRouter.use(resolveTenant);

// Public routes
visitorRouter.post('/track', visitorController.trackVisitor);
visitorRouter.get('/stats', visitorController.getVisitorStats);

// Admin routes (authenticate -> requireAdmin)
visitorRouter.get('/admin/stats', authenticate, requireAdmin, visitorController.getDetailedVisitorStats);
