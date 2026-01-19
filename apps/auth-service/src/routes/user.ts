import { Router, IRouter } from 'express';
import {
  updateProfile,
  changePassword,
  listUsers,
  updateUserRole,
  updateUserStatus,
  getUserPublicInfo,
  getUserStats,
} from '../controllers/user';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';

const router: IRouter = Router();

// Internal API - 서비스간 통신용 (인증 불필요, tenant만 필요)
router.get('/stats', resolveTenant, getUserStats);
router.get('/:userId/public', resolveTenant, getUserPublicInfo);

// 모든 User 라우트는 Tenant 식별 및 인증 필요
router.use(resolveTenant);
router.use(authenticate);

// 프로필 관리
router.patch('/profile', updateProfile);
router.post('/change-password', changePassword);

// 사용자 관리 (관리자 전용)
router.get('/', requireAdmin, listUsers);
router.patch('/:userId/role', requireAdmin, updateUserRole);
router.patch('/:userId/status', requireAdmin, updateUserStatus);

export default router;
