import { Router, IRouter } from 'express';
import * as bookmarkController from '../controllers/bookmark';
import { resolveTenant } from '../middleware/tenantResolver';
import { requireAuth } from '../middleware/authenticate';

export const bookmarkRouter: IRouter = Router();

// Apply tenant resolution and authentication to all routes
bookmarkRouter.use(resolveTenant);
bookmarkRouter.use(requireAuth);

// Protected routes (authentication required)
bookmarkRouter.get('/', bookmarkController.getBookmarks);
bookmarkRouter.post('/:postId', bookmarkController.toggleBookmark);
bookmarkRouter.get('/:postId/status', bookmarkController.checkBookmarkStatus);
