import { Router, IRouter } from 'express';
import { getDashboardStats } from '../controllers/stats';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();

// All stats routes require tenant and admin auth
router.use(resolveTenant);
router.use(authenticate);
router.use(requireAdmin);

// Dashboard stats
router.get('/dashboard', getDashboardStats);

export { router as statsRouter };
