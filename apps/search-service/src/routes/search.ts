import { Router } from 'express';
import { searchPosts, getSearchStats } from '../controllers/search';

const router = Router();

// Public search endpoint
router.get('/', searchPosts);

// Stats endpoint (for admin/debugging)
router.get('/stats', getSearchStats);

export const searchRouter = router;
