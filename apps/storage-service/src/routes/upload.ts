import { Router, IRouter } from 'express';
import { uploadFile } from '../controllers/storage';
import { resolveTenant } from '../middleware/tenantResolver';
import { optionalAuthenticate } from '../middleware/authenticate';
import { upload } from '../middleware/upload';

const router: IRouter = Router();

// Apply tenant resolution to all routes
router.use(resolveTenant);

// Image upload (optional authentication for guest uploads)
// POST /api/upload/image?type=avatar|cover|post
router.post('/image', optionalAuthenticate, upload.single('image') as any, uploadFile);

// General file upload (optional authentication)
// POST /api/upload
router.post('/', optionalAuthenticate, upload.single('file') as any, uploadFile);

export default router;
