import { Router, type IRouter } from 'express'
import { authenticate } from '../middleware/auth.js'
import {
  getDrafts,
  getDraftById,
  createDraft,
  updateDraft,
  deleteDraft,
  publishDraft,
} from '../controllers/drafts.js'

export const draftRouter: IRouter = Router()

// All draft routes require authentication
draftRouter.use(authenticate)

// CRUD
draftRouter.get('/', getDrafts)
draftRouter.get('/:id', getDraftById)
draftRouter.post('/', createDraft)
draftRouter.put('/:id', updateDraft)
draftRouter.delete('/:id', deleteDraft)

// Publish draft as post
draftRouter.post('/:id/publish', publishDraft)
