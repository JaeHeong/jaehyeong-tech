import { Router, IRouter } from 'express';
import { getWeeklyVisitors, getDetailedAnalytics } from '../controllers/ga4';
import { resolveTenant } from '../middleware/tenantResolver';
import { requireAdmin } from '../middleware/authenticate';

export const ga4Router: IRouter = Router();

// Apply tenant resolution
ga4Router.use(resolveTenant);

// Weekly visitors (admin only)
ga4Router.get('/visitors/weekly', requireAdmin, getWeeklyVisitors);

// Detailed analytics (admin only)
ga4Router.get('/detailed', requireAdmin, getDetailedAnalytics);
