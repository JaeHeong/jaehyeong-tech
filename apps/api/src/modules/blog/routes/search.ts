import { Router } from 'express';
import { searchPosts, getSearchStats } from '../controllers/search';
import { authenticate, requireAdmin } from '../../../middleware/authenticate';

export const searchRouter: Router = Router();
searchRouter.get('/', searchPosts);
searchRouter.get('/stats', authenticate, requireAdmin, getSearchStats);
