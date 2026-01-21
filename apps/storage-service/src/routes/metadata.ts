import { Router, IRouter } from 'express';
import { fetchUrlMetadata } from '../controllers/metadata';
import { resolveTenant } from '../middleware/tenantResolver';

const router: IRouter = Router();

// Apply tenant resolution
router.use(resolveTenant);

// POST /api/metadata - Fetch URL metadata for link bookmarks
router.post('/', fetchUrlMetadata);

export default router;
