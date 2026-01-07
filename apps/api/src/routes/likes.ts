import { Router, type IRouter } from 'express'
import { toggleLike, checkLikeStatus } from '../controllers/likes.js'
import { optionalAuth } from '../middleware/auth.js'

export const likeRouter: IRouter = Router()

// Toggle like (POST /api/likes/:id) - optionalAuth to support both logged-in and anonymous users
likeRouter.post('/:id', optionalAuth, toggleLike)

// Check like status (GET /api/likes/:id) - optionalAuth to check by userId or ipHash
likeRouter.get('/:id', optionalAuth, checkLikeStatus)
