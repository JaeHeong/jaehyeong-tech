import { Router, IRouter, Request, Response, NextFunction } from 'express';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();

// Apply tenant resolution and admin auth to all routes
router.use(resolveTenant);
router.use(authenticate);
router.use(requireAdmin);

// List backups
router.get('/', (_req: Request, res: Response) => {
  // TODO: Implement OCI backup list
  res.json({
    data: {
      backups: [],
      message: 'Backup functionality not yet implemented in MSA'
    }
  });
});

// Create backup
router.post('/', (_req: Request, res: Response) => {
  // TODO: Implement OCI backup creation
  res.status(501).json({
    message: 'Backup creation not yet implemented in MSA'
  });
});

// Get backup info
router.get('/:fileName/info', (_req: Request, res: Response) => {
  res.status(501).json({
    message: 'Backup info not yet implemented in MSA'
  });
});

// Download backup
router.get('/:fileName', (_req: Request, res: Response) => {
  res.status(501).json({
    message: 'Backup download not yet implemented in MSA'
  });
});

// Restore backup
router.post('/:fileName/restore', (_req: Request, res: Response) => {
  res.status(501).json({
    message: 'Backup restore not yet implemented in MSA'
  });
});

// Delete backup
router.delete('/:fileName', (_req: Request, res: Response) => {
  res.status(501).json({
    message: 'Backup delete not yet implemented in MSA'
  });
});

export default router;
