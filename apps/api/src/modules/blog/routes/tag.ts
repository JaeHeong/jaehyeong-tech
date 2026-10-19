import { Router, IRouter } from 'express';
import * as tagController from '../controllers/tag';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin, optionalAuthenticate } from '../middleware/authenticate';

export const tagRouter: IRouter = Router();

// Apply tenant resolution to all routes
tagRouter.use(resolveTenant);

// Public routes (with optional auth for admin features)
tagRouter.get('/', tagController.getTags);
tagRouter.get('/:slug', tagController.getTagBySlug);
tagRouter.get('/:slug/posts', optionalAuthenticate, tagController.getTagPosts);

// Admin routes (authenticate -> requireAdmin)
tagRouter.post('/', authenticate, requireAdmin, tagController.createTag);
tagRouter.put('/:id', authenticate, requireAdmin, tagController.updateTag);
tagRouter.delete('/:id', authenticate, requireAdmin, tagController.deleteTag);
