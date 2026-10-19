import { Router, IRouter } from 'express';
import { getSitemap, getRssFeed, getRobotsTxt } from '../controllers/seo';
import { resolveTenant } from '../middleware/tenantResolver';

const router: IRouter = Router();

// SEO endpoints - served at root level
// All need tenant resolution for database access
router.get('/sitemap.xml', resolveTenant, getSitemap);
router.get('/rss.xml', resolveTenant, getRssFeed);
router.get('/robots.txt', resolveTenant, getRobotsTxt);

export { router as seoRouter };
