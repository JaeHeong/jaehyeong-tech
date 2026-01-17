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
} from '../controllers/comment';
import { resolveTenant } from '../middleware/tenantResolver';
import { optionalAuthenticate, requireAuth, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();

// 모든 Comment 라우트는 Tenant 식별 필요
router.use(resolveTenant);

// 댓글 목록 조회 (인증 선택적)
router.get('/', optionalAuthenticate, getComments);

// 최근 댓글 조회 (공개) - /:id 보다 먼저 정의해야 함
router.get('/recent', getRecentComments);

// 내 댓글 목록 조회 (인증 필수) - /:id 보다 먼저 정의해야 함
router.get('/me', requireAuth, getMyComments);

// 관리자 일괄 삭제 - /:id 보다 먼저 정의해야 함
router.post('/bulk-delete', requireAuth, requireAdmin, bulkDeleteComments);

// 댓글 생성 (인증 선택적 - 익명 댓글 가능)
router.post('/', optionalAuthenticate, createComment);

// 댓글 상세 조회
router.get('/:id', optionalAuthenticate, getComment);

// 댓글 수정 (인증 필수 - 본인만)
router.patch('/:id', requireAuth, updateComment);

// 댓글 삭제 (인증 필수 - 본인만)
router.delete('/:id', requireAuth, deleteComment);

// 관리자 기능
router.post('/:id/approve', requireAuth, requireAdmin, approveComment);
router.patch('/:id/status', requireAuth, requireAdmin, updateCommentStatus);

export default router;
