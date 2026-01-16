import { Router, Request, Response } from 'express';
import { tenantPrisma } from '../services/prisma';
import { tenantResolver, Tenant } from '../middleware/tenantResolver';

const router = Router();

// Get author (blog owner) public info
router.get('/', tenantResolver, async (req: Request, res: Response) => {
  try {
    const tenant = req.tenant as Tenant;
    if (!tenant) {
      return res.status(400).json({ message: 'Tenant을 식별할 수 없습니다.' });
    }

    const prisma = tenantPrisma.getClient(tenant.id);

    // Get the most recently updated admin user as the blog author
    const author = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        role: 'ADMIN',
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        name: true,
        title: true,
        bio: true,
        avatar: true,
        github: true,
        twitter: true,
        linkedin: true,
        website: true,
      },
    });

    if (!author) {
      // Return default author info if no admin exists
      return res.json({
        data: {
          name: 'Jaehyeong',
          title: 'DevOps Engineer',
          bio: '클라우드 인프라와 자동화, 그리고 MLOps 파이프라인 구축에 열정을 가진 엔지니어입니다. 배운 것을 기록하고 공유합니다.',
          avatar: null,
          github: null,
          twitter: null,
          linkedin: null,
          website: null,
        },
      });
    }

    res.json({ data: author });
  } catch (error) {
    console.error('Failed to fetch author:', error);
    res.status(500).json({ message: 'Failed to fetch author info' });
  }
});

export default router;
