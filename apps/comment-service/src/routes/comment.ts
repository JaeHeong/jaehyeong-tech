import { Router, IRouter } from 'express';
import {
  createComment,
  getComments,
  getComment,
  getRecentComments,
  getMyComments,
  updateComment,
  deleteComment,
  approveComment,
  updateCommentStatus,
  bulkDeleteComments,
  getAllComments,
  adminDeleteComment,
  getCommentStats,
  getCommentCount,
} from '../controllers/comment';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, optionalAuthenticate, requireAuth, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();

// 모든 Comment 라우트는 Tenant 식별 필요
router.use(resolveTenant);

// 댓글 목록 조회 (인증 선택적)
router.get('/', optionalAuthenticate, getComments);

// 최근 댓글 조회 (공개) - /:id 보다 먼저 정의해야 함
router.get('/recent', getRecentComments);

// Stats route (for internal service calls)
router.get('/stats', getCommentStats);

// Comment count for specific resource (for internal service calls)
router.get('/count', getCommentCount);

// 내 댓글 목록 조회 (인증 필수) - /:id 보다 먼저 정의해야 함
router.get('/me', authenticate, getMyComments);

// Admin routes - /:id 보다 먼저 정의해야 함
router.get('/admin', authenticate, requireAdmin, getAllComments);
router.delete('/admin/:id', authenticate, requireAdmin, adminDeleteComment);
router.post('/admin/bulk-delete', authenticate, requireAdmin, bulkDeleteComments);

// 댓글 생성 (인증 선택적 - 익명 댓글 가능)
router.post('/', optionalAuthenticate, createComment);

// 댓글 상세 조회
router.get('/:id', optionalAuthenticate, getComment);

// 댓글 수정 (인증 필수 - 본인만)
router.patch('/:id', authenticate, updateComment);

// 댓글 삭제 (인증 필수 - 본인만)
router.delete('/:id', authenticate, deleteComment);

// 관리자 기능
router.post('/:id/approve', authenticate, requireAdmin, approveComment);
router.patch('/:id/status', authenticate, requireAdmin, updateCommentStatus);

export default router;
