import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/auth.js'
import { upload, uploadImage } from '../controllers/upload.js'

export const uploadRouter: IRouter = Router()

// POST /api/upload/image - Upload a single image
uploadRouter.post('/image', authenticate, upload.single('image'), uploadImage)
