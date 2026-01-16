import { Router } from 'express';
import * as pageController from '../controllers/page';
import { resolveTenant } from '../middleware/tenantResolver';
import { optionalAuthenticate, requireAdmin } from '../middleware/authenticate';

export const pageRouter = Router();

// Apply tenant resolution to all routes
pageRouter.use(resolveTenant);

// Public routes (with optional auth for draft visibility check)
pageRouter.get('/', pageController.getPages);
pageRouter.get('/notices', pageController.getNotices);
pageRouter.get('/:slug', optionalAuthenticate, pageController.getPageBySlug);
pageRouter.get('/notices/:slug/adjacent', pageController.getAdjacentNotices);

// Admin routes
pageRouter.get('/admin/all', requireAdmin, pageController.getAllPagesAdmin);
pageRouter.get('/admin/stats', requireAdmin, pageController.getPageStats);
pageRouter.get('/admin/:id', requireAdmin, pageController.getPageById);
pageRouter.post('/', requireAdmin, pageController.createPage);
pageRouter.put('/:id', requireAdmin, pageController.updatePage);
pageRouter.delete('/:id', requireAdmin, pageController.deletePage);
