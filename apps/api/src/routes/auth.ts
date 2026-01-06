import { Router, type IRouter } from 'express'
import * as authController from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'
import { validateBody } from '../validation/middleware.js'
import { loginSchema, registerSchema, googleAuthSchema, updateAuthorSchema } from '../validation/schemas.js'

export const authRouter: IRouter = Router()

authRouter.post('/login', validateBody(loginSchema), authController.login)
authRouter.post('/register', validateBody(registerSchema), authController.register)
authRouter.post('/google', validateBody(googleAuthSchema), authController.googleLogin)
authRouter.get('/me', authenticate, authController.getMe)
authRouter.put('/me', authenticate, validateBody(updateAuthorSchema), authController.updateMe)
