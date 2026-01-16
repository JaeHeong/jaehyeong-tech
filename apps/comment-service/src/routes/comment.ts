import { Router } from 'express';
import {
  createComment,
  getComments,
  getComment,
  updateComment,
  deleteComment,
  approveComment,
  updateCommentStatus,
} from '../controllers/comment';
import { resolveTenant } from '../middleware/tenantResolver';
import { optionalAuthenticate, requireAuth, requireAdmin } from '../middleware/authenticate';

const router = Router();

// 모든 Comment 라우트는 Tenant 식별 필요
router.use(resolveTenant);

// 댓글 목록 조회 (인증 선택적)
router.get('/', optionalAuthenticate, getComments);

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
