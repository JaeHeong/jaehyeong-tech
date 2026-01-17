import { Router, IRouter } from 'express';
import * as draftController from '../controllers/draft';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

export const draftRouter: IRouter = Router();

// Apply tenant resolution to all routes
draftRouter.use(resolveTenant);

// All draft routes require admin authentication (authenticate -> requireAdmin)
draftRouter.get('/', authenticate, requireAdmin, draftController.getDrafts);
draftRouter.post('/', authenticate, requireAdmin, draftController.createDraft);
draftRouter.get('/:id', authenticate, requireAdmin, draftController.getDraftById);
draftRouter.put('/:id', authenticate, requireAdmin, draftController.updateDraft);
draftRouter.delete('/:id', authenticate, requireAdmin, draftController.deleteDraft);
draftRouter.post('/:id/publish', authenticate, requireAdmin, draftController.publishDraft);
