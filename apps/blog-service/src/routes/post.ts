import { Router, IRouter } from 'express';
import * as postController from '../controllers/post';
import * as likeController from '../controllers/like';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, optionalAuthenticate, requireAdmin } from '../middleware/authenticate';

export const postRouter: IRouter = Router();

// Apply tenant resolution to all routes
postRouter.use(resolveTenant);

// Public routes (with optional auth)
postRouter.get('/', optionalAuthenticate, postController.getPosts);
postRouter.get('/featured', postController.getFeaturedPosts);
postRouter.get('/top-viewed', postController.getTopViewedPost);
postRouter.get('/:slug', optionalAuthenticate, postController.getPostBySlug);
postRouter.get('/:slug/adjacent', postController.getAdjacentPosts);
postRouter.get('/:slug/related', postController.getRelatedPosts);

// Like routes (public, with optional auth)
postRouter.post('/:id/like', optionalAuthenticate, likeController.toggleLike);
postRouter.get('/:id/like', optionalAuthenticate, likeController.checkLikeStatus);

// Admin routes (authenticate -> requireAdmin)
postRouter.get('/admin/:id', authenticate, requireAdmin, postController.getPostById);
postRouter.post('/bulk-delete', authenticate, requireAdmin, postController.bulkDeletePosts);
postRouter.post('/', authenticate, requireAdmin, postController.createPost);
postRouter.put('/:id', authenticate, requireAdmin, postController.updatePost);
postRouter.delete('/:id', authenticate, requireAdmin, postController.deletePost);
