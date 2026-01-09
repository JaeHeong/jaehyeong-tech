import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/auth.js'
import * as usersController from '../controllers/users.js'

export const usersRouter: IRouter = Router()

// All routes require authentication
usersRouter.get('/', authenticate, usersController.getUsers)
usersRouter.get('/stats', authenticate, usersController.getUserStats)
usersRouter.get('/signup-trend', authenticate, usersController.getSignupTrend)
usersRouter.get('/signup-pattern', authenticate, usersController.getSignupPattern)
usersRouter.patch('/:id/status', authenticate, usersController.updateUserStatus)
usersRouter.delete('/:id', authenticate, usersController.deleteUser)
