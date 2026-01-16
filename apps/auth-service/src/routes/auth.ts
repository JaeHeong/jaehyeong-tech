import { Router } from 'express';
import { register, login, googleLogin, getCurrentUser } from '../controllers/auth';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate } from '../middleware/authenticate';

const router = Router();

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

export default router;
