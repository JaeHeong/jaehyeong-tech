import { Router, IRouter } from 'express';
import * as pageController from '../controllers/page';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/authenticate';

export const pageRouter: IRouter = Router();

// Apply tenant resolution to all routes
pageRouter.use(resolveTenant);

// Public routes (with optional auth for draft visibility check)
pageRouter.get('/', pageController.getPages);
pageRouter.get('/notices', pageController.getNotices);
pageRouter.get('/:slug', optionalAuthenticate, pageController.getPageBySlug);
pageRouter.get('/notices/:slug/adjacent', pageController.getAdjacentNotices);

// Admin routes (authenticate -> requireAdmin)
pageRouter.get('/admin', authenticate, requireAdmin, pageController.getAllPagesAdmin);
pageRouter.get('/admin/stats', authenticate, requireAdmin, pageController.getPageStats);
pageRouter.get('/admin/:id', authenticate, requireAdmin, pageController.getPageById);
pageRouter.post('/', authenticate, requireAdmin, pageController.createPage);
pageRouter.put('/:id', authenticate, requireAdmin, pageController.updatePage);
pageRouter.delete('/:id', authenticate, requireAdmin, pageController.deletePage);
