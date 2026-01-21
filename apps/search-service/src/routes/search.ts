import { Router, IRouter } from 'express';
import { searchPosts, getSearchStats } from '../controllers/search';

const router: IRouter = Router();

// Public search endpoint
router.get('/', searchPosts);

// Stats endpoint (for admin/debugging)
router.get('/stats', getSearchStats);

export const searchRouter: IRouter = router;
