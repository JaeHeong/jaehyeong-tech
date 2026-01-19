import { Router, IRouter } from 'express';
import { getWeeklyVisitors, getDetailedAnalytics, getPageAnalytics } from '../controllers/analytics';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import { resolveTenant } from '../middleware/tenantResolver';

const router: IRouter = Router();

// Apply tenant resolution to all routes
router.use(resolveTenant);

// Public endpoint - no auth required
router.get('/weekly', getWeeklyVisitors);

// Admin only - detailed analytics
router.get('/detailed', authenticate, requireAdmin, getDetailedAnalytics);

// Admin only - page-specific analytics
router.get('/page', authenticate, requireAdmin, getPageAnalytics);

export { router as analyticsRouter };
