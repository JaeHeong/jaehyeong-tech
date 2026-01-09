import { Router, type IRouter } from 'express'
import { toggleBookmark, checkBookmarkStatus, getMyBookmarks, removeBookmark } from '../controllers/bookmarks.js'
import { authenticate, optionalAuth } from '../middleware/auth.js'

export const bookmarkRouter: IRouter = Router()

// Get user's bookmarks (GET /api/bookmarks) - requires auth
bookmarkRouter.get('/', authenticate, getMyBookmarks)

// Toggle bookmark (POST /api/bookmarks/:id) - requires auth
bookmarkRouter.post('/:id', authenticate, toggleBookmark)

// Check bookmark status (GET /api/bookmarks/:id) - optionalAuth to return false for anonymous
bookmarkRouter.get('/:id', optionalAuth, checkBookmarkStatus)

// Remove bookmark (DELETE /api/bookmarks/:id) - requires auth
bookmarkRouter.delete('/:id', authenticate, removeBookmark)
