import { Router, IRouter } from 'express';
import * as draftController from '../controllers/draft';
import { resolveTenant } from '../middleware/tenantResolver';
import { requireAdmin } from '../middleware/authenticate';

export const draftRouter: IRouter = Router();

// Apply tenant resolution to all routes
draftRouter.use(resolveTenant);

// All draft routes require admin authentication
draftRouter.get('/', requireAdmin, draftController.getDrafts);
draftRouter.post('/', requireAdmin, draftController.createDraft);
draftRouter.get('/:id', requireAdmin, draftController.getDraftById);
draftRouter.put('/:id', requireAdmin, draftController.updateDraft);
draftRouter.delete('/:id', requireAdmin, draftController.deleteDraft);
draftRouter.post('/:id/publish', requireAdmin, draftController.publishDraft);
