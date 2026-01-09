import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/auth.js'
import * as usersController from '../controllers/users.js'

export const usersRouter: IRouter = Router()

// User's own profile routes (non-admin)
usersRouter.get('/me', authenticate, usersController.getMyProfile)
usersRouter.put('/me', authenticate, usersController.updateMyProfile)

// Admin routes
usersRouter.get('/', authenticate, usersController.getUsers)
usersRouter.get('/stats', authenticate, usersController.getUserStats)
usersRouter.get('/signup-trend', authenticate, usersController.getSignupTrend)
usersRouter.get('/signup-pattern', authenticate, usersController.getSignupPattern)
usersRouter.patch('/:id/status', authenticate, usersController.updateUserStatus)
usersRouter.delete('/:id', authenticate, usersController.deleteUser)
