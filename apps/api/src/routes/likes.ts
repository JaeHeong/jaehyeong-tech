import { Router, type IRouter } from 'express'
import { toggleLike, checkLikeStatus } from '../controllers/likes.js'

export const likeRouter: IRouter = Router()

// Toggle like (POST /api/likes/:id)
likeRouter.post('/:id', toggleLike)

// Check like status (GET /api/likes/:id)
likeRouter.get('/:id', checkLikeStatus)
