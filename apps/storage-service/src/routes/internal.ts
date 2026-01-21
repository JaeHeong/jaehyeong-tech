import { Router, IRouter } from 'express';
import { deleteFileByUrl } from '../controllers/storage';
import { resolveTenant } from '../middleware/tenantResolver';

const router: IRouter = Router();

// Internal APIs - for service-to-service communication
// These endpoints don't require user authentication but need tenant context

// Apply tenant resolution to all routes
router.use(resolveTenant);

// Delete file by URL (used by auth-service when avatar changes)
// POST /internal/delete-by-url
router.post('/delete-by-url', deleteFileByUrl);

export default router;
