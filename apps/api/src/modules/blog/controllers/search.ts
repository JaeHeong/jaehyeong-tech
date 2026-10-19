import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../db';
import type { Prisma } from '../../../generated/prisma';
import { AppError } from '../../../middleware/errorHandler';

export function searchOptions(query: Request['query'], tenantId: string) {
  const integer = (value: unknown, fallback: number) => {
    if (value === undefined) return fallback;
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < 1) throw new AppError('페이지와 개수는 양의 정수여야 합니다.', 400);
    return n;
  };
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  if (q.length > 200) throw new AppError('검색어는 200자 이내로 입력해주세요.', 400);
  const page = integer(query.page, 1);
  const limit = Math.min(integer(query.limit, 10), 100);
  if (page > 1000000) throw new AppError('페이지 범위를 초과했습니다.', 400);
  const where: Prisma.PostWhereInput = { tenantId, status: 'PUBLIC' };
  const terms = [...new Set(q.split(/\s+/).filter(Boolean))].slice(0, 20);
  if (terms.length) {
    where.AND = terms.map(term => {
      // Treat LIKE wildcard characters as ordinary search text.
      const contains = term.replace(/[\\%_]/g, '\\$&');
      return { OR: [
        { title: { contains, mode: 'insensitive' } },
        { excerpt: { contains, mode: 'insensitive' } },
        { content: { contains, mode: 'insensitive' } },
        { category: { name: { contains, mode: 'insensitive' } } },
        { tags: { some: { name: { contains, mode: 'insensitive' } } } },
      ] };
    });
  }
  if (typeof query.category === 'string') where.category = { slug: query.category };
  if (typeof query.tag === 'string') where.tags = { some: { OR: [{ name: query.tag }, { slug: query.tag }] } };
  const sorts = ['publishedAt', 'viewCount', 'likeCount'] as const;
  const sort = sorts.find(key => key === query.sortBy) || 'publishedAt';
  const orderBy: Prisma.PostOrderByWithRelationInput[] = [
    { [sort]: query.sortOrder === 'asc' ? 'asc' : 'desc' }, { id: 'asc' },
  ];
  return { q, page, limit, where, orderBy };
}

export async function searchPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const started = performance.now();
    const { q, page, limit, where, orderBy } = searchOptions(req.query, req.tenant!.id);
    const [posts, total] = await prisma.$transaction([
      prisma.post.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit,
        include: { category: true, tags: true } }),
      prisma.post.count({ where }),
    ]);
    const authors = await prisma.user.findMany({
      where: { tenantId: req.tenant!.id, id: { in: [...new Set(posts.map(post => post.authorId))] } },
      select: { id: true, name: true },
    });
    const names = new Map(authors.map(author => [author.id, author.name]));
    res.json({
      success: true,
      data: posts.map(post => ({
        ...post, content: post.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        categoryName: post.category.name, categorySlug: post.category.slug,
        tags: post.tags.map(tag => tag.name), authorName: names.get(post.authorId) || '',
        publishedAt: post.publishedAt?.getTime() ?? null,
        createdAt: post.createdAt.getTime(), updatedAt: post.updatedAt.getTime(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      meta: { query: q, processingTimeMs: Math.round(performance.now() - started) },
    });
  } catch (error) { next(error); }
}

export async function getSearchStats(req: Request, res: Response, next: NextFunction) {
  try {
    const numberOfDocuments = await prisma.post.count({ where: { tenantId: req.tenant!.id, status: 'PUBLIC' } });
    res.json({ success: true, data: { numberOfDocuments, isIndexing: false, fieldDistribution: {} } });
  } catch (error) { next(error); }
}
