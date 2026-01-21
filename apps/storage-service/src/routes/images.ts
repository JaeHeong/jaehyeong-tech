import { Router, IRouter } from 'express';
import { getImageStats, getOrphanFiles, deleteOrphanFiles } from '../controllers/storage';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();

// Apply tenant resolution to all routes
router.use(resolveTenant);

// Stats route (for internal service calls)
router.get('/stats', getImageStats);

// Orphan images routes (admin only)
router.get('/orphans', authenticate, requireAdmin, getOrphanFiles);
router.delete('/orphans', authenticate, requireAdmin, deleteOrphanFiles);

export default router;
