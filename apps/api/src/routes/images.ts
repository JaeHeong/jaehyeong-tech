import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/auth.js'
import { getOrphanImages, deleteOrphanImages } from '../controllers/images.js'

const router: IRouter = Router()

// All routes require authentication
router.use(authenticate)

// Image management routes
router.get('/orphans', getOrphanImages)
router.delete('/orphans', deleteOrphanImages)

export { router as imageRouter }
