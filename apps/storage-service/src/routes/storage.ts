import { Router, IRouter } from 'express';
import {
  uploadFile,
  getFiles,
  getFile,
  deleteFile,
  deleteFileByUrl,
  getOrphanFiles,
  deleteOrphanFiles,
} from '../controllers/storage';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, optionalAuthenticate, requireAuth, requireAdmin } from '../middleware/authenticate';
import { upload } from '../middleware/upload';

const router: IRouter = Router();

// 모든 Storage 라우트는 Tenant 식별 필요
router.use(resolveTenant);

// 파일 업로드 (인증 선택적)
router.post('/upload', optionalAuthenticate, upload.single('file') as any, uploadFile);

// 파일 목록 조회
router.get('/', optionalAuthenticate, getFiles);

// 고아 파일 관리 (관리자 전용) - /:id 보다 먼저 정의 (authenticate -> requireAdmin)
router.get('/orphans', authenticate, requireAdmin, getOrphanFiles);
router.delete('/orphans', authenticate, requireAdmin, deleteOrphanFiles);

// 파일 상세 조회
router.get('/:id', optionalAuthenticate, getFile);

// 파일 삭제 (인증 필수)
router.delete('/:id', requireAuth, deleteFile);

// 파일 삭제 by URL (인증 필수)
router.post('/delete-by-url', requireAuth, deleteFileByUrl);

export default router;
