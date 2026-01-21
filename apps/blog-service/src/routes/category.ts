import { Router, IRouter } from 'express';
import * as categoryController from '../controllers/category';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin, optionalAuthenticate } from '../middleware/authenticate';

export const categoryRouter: IRouter = Router();

// Apply tenant resolution to all routes
categoryRouter.use(resolveTenant);

// Public routes (with optional auth for admin features)
categoryRouter.get('/', categoryController.getCategories);
categoryRouter.get('/:slug', categoryController.getCategoryBySlug);
categoryRouter.get('/:slug/posts', optionalAuthenticate, categoryController.getCategoryPosts);

// Admin routes (authenticate -> requireAdmin)
categoryRouter.post('/', authenticate, requireAdmin, categoryController.createCategory);
categoryRouter.put('/:id', authenticate, requireAdmin, categoryController.updateCategory);
categoryRouter.delete('/:id', authenticate, requireAdmin, categoryController.deleteCategory);
