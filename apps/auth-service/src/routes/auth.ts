import { Router, IRouter } from 'express';
import { register, login, googleLogin, getCurrentUser, updateCurrentUser } from '../controllers/auth';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate } from '../middleware/authenticate';

const router: IRouter = Router();

// 모든 Auth 라우트는 Tenant 식별 필요
router.use(resolveTenant);

// 회원가입
router.post('/register', register);

// 로그인
router.post('/login', login);

// Google OAuth 로그인
router.post('/google', googleLogin);

// 현재 사용자 정보 조회 (인증 필요)
router.get('/me', authenticate, getCurrentUser);

// 현재 사용자 정보 수정 (인증 필요)
router.put('/me', authenticate, updateCurrentUser);

export default router;
