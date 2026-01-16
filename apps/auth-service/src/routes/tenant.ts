import { Router } from 'express';
import { createTenant, listTenants, getTenant, updateTenant } from '../controllers/tenant';

const router = Router();

// Tenant 관리 (슈퍼 관리자 전용 - X-Super-Admin-Key 헤더 필요)
router.post('/', createTenant);
router.get('/', listTenants);
router.get('/:id', getTenant);
router.patch('/:id', updateTenant);

export default router;
