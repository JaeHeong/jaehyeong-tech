import { Request, Response, NextFunction } from 'express';
import { tenantPrisma } from '../services/prisma';
import '@shared/types/express';

const SITE_URL = process.env.SITE_URL || 'https://dev-tech.jaehyeong.site';

/**
 * Generate sitemap.xml
 */
export async function getSitemap(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    const [posts, categories, tags] = await Promise.all([
      prisma.post.findMany({
        where: { status: 'PUBLIC' },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
      }),
      prisma.category.findMany({
        select: { slug: true },
      }),
      prisma.tag.findMany({
        select: { slug: true },
      }),
    ]);

    const urls: string[] = [];

    // Homepage
    urls.push(`
  <url>
    <loc>${SITE_URL}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`);

    // Posts
    for (const post of posts) {
      const lastmod = post.updatedAt.toISOString().split('T')[0];
      urls.push(`
  <url>
    <loc>${SITE_URL}/posts/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
    }

    // Categories
    for (const category of categories) {
      urls.push(`
  <url>
    <loc>${SITE_URL}/categories/${category.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
    }

    // Tags
    for (const tag of tags) {
      urls.push(`
  <url>
    <loc>${SITE_URL}/tags/${tag.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`);
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(sitemap);
  } catch (error) {
    next(error);
  }
}

/**
 * Generate RSS feed
 */
export async function getRssFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    const posts = await prisma.post.findMany({
      where: { status: 'PUBLIC' },
      include: {
        category: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const items = posts.map((post) => {
      const pubDate = post.publishedAt
        ? new Date(post.publishedAt).toUTCString()
        : new Date(post.createdAt).toUTCString();

      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/posts/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/posts/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || '')}</description>
      <pubDate>${pubDate}</pubDate>
      ${post.category ? `<category>${escapeXml(post.category.name)}</category>` : ''}
    </item>`;
    });

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Jaehyeong Tech Blog</title>
    <link>${SITE_URL}</link>
    <description>기술 블로그 - 개발, 프로그래밍, 기술 이야기</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>${items.join('')}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(rss);
  } catch (error) {
    next(error);
  }
}

/**
 * Generate robots.txt
 */
export function getRobotsTxt(_req: Request, res: Response) {
  const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;

  res.set('Content-Type', 'text/plain');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(robots);
}
