import { Router } from 'express';
import * as categoryController from '../controllers/category';
import { resolveTenant } from '../middleware/tenantResolver';
import { requireAdmin } from '../middleware/authenticate';

export const categoryRouter = Router();

// Apply tenant resolution to all routes
categoryRouter.use(resolveTenant);

// Public routes
categoryRouter.get('/', categoryController.getCategories);
categoryRouter.get('/:slug', categoryController.getCategoryBySlug);

// Admin routes
categoryRouter.post('/', requireAdmin, categoryController.createCategory);
categoryRouter.put('/:id', requireAdmin, categoryController.updateCategory);
categoryRouter.delete('/:id', requireAdmin, categoryController.deleteCategory);
