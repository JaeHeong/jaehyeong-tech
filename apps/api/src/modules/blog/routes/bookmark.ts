import { Router, IRouter } from 'express';
import * as bookmarkController from '../controllers/bookmark';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAuth } from '../middleware/authenticate';

export const bookmarkRouter: IRouter = Router();

// Apply tenant resolution and authentication to all routes
// 1. resolveTenant: reads x-tenant-id header
// 2. authenticate: reads x-user-id, x-user-email, x-user-role headers and sets req.user
// 3. requireAuth: checks if req.user exists
bookmarkRouter.use(resolveTenant);
bookmarkRouter.use(authenticate);
bookmarkRouter.use(requireAuth);

// Protected routes (authentication required)
bookmarkRouter.get('/', bookmarkController.getBookmarks);
bookmarkRouter.post('/:postId', bookmarkController.toggleBookmark);
bookmarkRouter.get('/:postId/status', bookmarkController.checkBookmarkStatus);
