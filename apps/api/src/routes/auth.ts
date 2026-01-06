import { Router, type IRouter } from 'express'
import * as authController from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'

export const authRouter: IRouter = Router()

authRouter.post('/login', authController.login)
authRouter.post('/register', authController.register)
authRouter.post('/google', authController.googleLogin)
authRouter.get('/me', authenticate, authController.getMe)
authRouter.put('/me', authenticate, authController.updateMe)
