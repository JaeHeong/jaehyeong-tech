import { Router, IRouter } from 'express';
import { getImageStats } from '../controllers/storage';
import { resolveTenant } from '../middleware/tenantResolver';

const router: IRouter = Router();

// Apply tenant resolution to all routes
router.use(resolveTenant);

// Stats route (for internal service calls)
router.get('/stats', getImageStats);

export default router;
