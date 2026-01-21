import { Router, IRouter } from 'express';
import * as likeController from '../controllers/like';
import { resolveTenant } from '../middleware/tenantResolver';
import { optionalAuthenticate } from '../middleware/authenticate';

export const likeRouter: IRouter = Router();

// Apply tenant resolution to all routes
likeRouter.use(resolveTenant);

// Like routes support both authenticated and anonymous users
likeRouter.post('/:postId', optionalAuthenticate, likeController.toggleLike);
likeRouter.get('/:postId', optionalAuthenticate, likeController.checkLikeStatus);
