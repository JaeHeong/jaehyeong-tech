import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import { tenantPrisma } from '../services/prisma';
import { ociStorage } from '../services/ociStorage';
import { eventPublisher } from '../services/eventPublisher';
import { AppError } from '../middleware/errorHandler';
import { getFileType, generateFileName } from '../middleware/upload';
import { FileType as PrismaFileType } from '../generated/prisma';
import { FileType as SharedFileType } from '@shared/types';
import { storageCache } from '@shared/utils';
import {
  optimizeImage,
  getOptimizedFilename,
  getOptimizedMimetype,
  type OptimizeOptions,
} from '../services/imageOptimizer';

const BLOG_SERVICE_URL = process.env.BLOG_SERVICE_URL || 'http://blog-service:3002';

interface ImageUrlsResponse {
  urls: string[];
  count: number;
  breakdown: {
    postCover: string[];
    postContent: string[];
    draftCover: string[];
    draftContent: string[];
  };
}

interface ImageUrlsCounts {
  postCover: number;
  postContent: number;
  draftCover: number;
  draftContent: number;
}

interface DetailedImageUrls {
  allUrls: Set<string>;
  breakdown: {
    postCover: Set<string>;
    postContent: Set<string>;
    draftCover: Set<string>;
    draftContent: Set<string>;
  };
  counts: ImageUrlsCounts;
}

/**
 * Fetch image URLs used in posts/drafts from blog-service (with Redis caching)
 * Returns detailed breakdown: postCover, postContent, draftCover, draftContent
 */
async function getDetailedImageUrls(tenantId: string, tenantName: string): Promise<DetailedImageUrls> {
  const cacheKey = `image-urls-detailed:${tenantId}`;

  // Check cache first (short TTL since drafts change frequently)
  const cached = await storageCache.get<{
    urls: string[];
    breakdown: ImageUrlsResponse['breakdown'];
    counts: ImageUrlsCounts;
  }>(cacheKey);

  if (cached) {
    return {
      allUrls: new Set(cached.urls),
      breakdown: {
        postCover: new Set(cached.breakdown.postCover),
        postContent: new Set(cached.breakdown.postContent),
        draftCover: new Set(cached.breakdown.draftCover),
        draftContent: new Set(cached.breakdown.draftContent),
      },
      counts: cached.counts,
    };
  }

  try {
    const response = await fetch(`${BLOG_SERVICE_URL}/internal/draft-image-urls`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
        'x-tenant-id': tenantId,
        'x-tenant-name': tenantName,
      },
    });

    if (!response.ok) {
      console.warn('[Storage] Failed to fetch image URLs:', response.status);
      return {
        allUrls: new Set(),
        breakdown: {
          postCover: new Set(),
          postContent: new Set(),
          draftCover: new Set(),
          draftContent: new Set(),
        },
        counts: { postCover: 0, postContent: 0, draftCover: 0, draftContent: 0 },
      };
    }

    const result = await response.json() as {
      success: boolean;
      data: ImageUrlsResponse;
      meta: { counts: ImageUrlsCounts };
    };

    const data = result.data;
    const counts = result.meta?.counts || {
      postCover: data.breakdown?.postCover?.length || 0,
      postContent: data.breakdown?.postContent?.length || 0,
      draftCover: data.breakdown?.draftCover?.length || 0,
      draftContent: data.breakdown?.draftContent?.length || 0,
    };

    // Cache for 30 seconds
    await storageCache.set(cacheKey, {
      urls: data.urls,
      breakdown: data.breakdown,
      counts,
    }, 30);

    return {
      allUrls: new Set(data.urls),
      breakdown: {
        postCover: new Set(data.breakdown?.postCover || []),
        postContent: new Set(data.breakdown?.postContent || []),
        draftCover: new Set(data.breakdown?.draftCover || []),
        draftContent: new Set(data.breakdown?.draftContent || []),
      },
      counts,
    };
  } catch (error) {
    console.error('[Storage] Error fetching image URLs:', error);
    return {
      allUrls: new Set(),
      breakdown: {
        postCover: new Set(),
        postContent: new Set(),
        draftCover: new Set(),
        draftContent: new Set(),
      },
      counts: { postCover: 0, postContent: 0, draftCover: 0, draftContent: 0 },
    };
  }
}

/**
 * Legacy function for backward compatibility
 */
async function getDraftImageUrls(tenantId: string, tenantName: string): Promise<Set<string>> {
  const detailed = await getDetailedImageUrls(tenantId, tenantName);
  return detailed.allUrls;
}

/**
 * Check if a URL is an external image (not from our CDN/storage)
 */
function isExternalUrl(url: string): boolean {
  const cdnDomain = process.env.CDN_DOMAIN;
  const ociRegion = process.env.OCI_REGION || 'ap-chuncheon-1';

  // Internal URL patterns
  const internalPatterns = [
    cdnDomain ? `https://${cdnDomain}/` : null,
    `https://objectstorage.${ociRegion}.oraclecloud.com/`,
    '/api/files/', // Relative API URLs
  ].filter(Boolean) as string[];

  return !internalPatterns.some((pattern) => url.includes(pattern));
}

/**
 * 파일 업로드
 */
export async function uploadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const file = req.file;

    if (!file) {
      throw new AppError('파일이 제공되지 않았습니다.', 400);
    }

    const { resourceType, resourceId, folder = 'uploads' } = req.body;
    const uploadType = req.query.type as string | undefined;

    // Determine folder based on type
    const actualFolder = uploadType === 'avatar' ? 'avatars' : folder;

    const fileType = getFileType(file.mimetype);
    const originalSize = file.size;

    let buffer = file.buffer;
    let width: number | undefined;
    let height: number | undefined;
    let finalMimetype = file.mimetype;
    let finalFileName = generateFileName(file.originalname);
    let format: string | undefined;

    // 이미지 파일인 경우 최적화 (WebP 변환 + 리사이즈)
    if (fileType === 'IMAGE') {
      try {
        // Determine optimization type
        let optimizeType: OptimizeOptions['type'] = 'post';
        if (uploadType === 'avatar') {
          optimizeType = 'avatar';
        } else if (uploadType === 'cover') {
          optimizeType = 'cover';
        }

        // Optimize image (WebP conversion + resize)
        const optimized = await optimizeImage(file.buffer, file.mimetype, { type: optimizeType });

        buffer = optimized.buffer;
        width = optimized.width;
        height = optimized.height;
        format = optimized.format;

        // Update filename and mimetype for optimized image
        finalFileName = getOptimizedFilename(finalFileName, optimized.format);
        finalMimetype = getOptimizedMimetype(optimized.format);

        // Log compression info
        const savings = originalSize - optimized.size;
        const savingsPercent = ((savings / originalSize) * 100).toFixed(1);
        console.log(
          `Image optimized: ${file.originalname} (${optimizeType}) - ` +
            `${(originalSize / 1024).toFixed(1)}KB → ${(optimized.size / 1024).toFixed(1)}KB ` +
            `(${savingsPercent}% saved, ${width}x${height})`
        );
      } catch (error) {
        console.warn('⚠️ Image optimization failed, using original:', error);
        // Fallback: get basic metadata
        try {
          const metadata = await sharp(buffer).metadata();
          width = metadata.width;
          height = metadata.height;
        } catch {
          // Ignore metadata error
        }
      }
    }

    // OCI에 업로드 (tenant.name 없으면 tenant.id 사용)
    const tenantPath = tenant.name || tenant.id;
    const url = await ociStorage.uploadFile(tenantPath, actualFolder, finalFileName, buffer, finalMimetype);

    const objectName = `${tenantPath}/${actualFolder}/${finalFileName}`;

    // 메타데이터 저장
    const fileRecord = await prisma.file.create({
      data: {
        tenantId: tenant.id,
        fileName: finalFileName,
        originalFileName: file.originalname,
        mimeType: finalMimetype,
        size: buffer.length,
        storageProvider: 'oci',
        storagePath: objectName,
        objectName,
        folder: actualFolder,
        url,
        resourceType,
        resourceId,
        fileType: fileType as PrismaFileType,
        width,
        height,
        uploadedBy: req.user?.id,
      },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'file.uploaded',
      tenantId: tenant.id,
      data: {
        fileId: fileRecord.id,
        fileName: fileRecord.fileName,
        fileType: fileRecord.fileType as unknown as SharedFileType,
        size: fileRecord.size,
        resourceType: fileRecord.resourceType ?? undefined,
        resourceId: fileRecord.resourceId ?? undefined,
        uploadedBy: fileRecord.uploadedBy ?? undefined,
      },
    });

    res.status(201).json({
      data: {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        originalFileName: fileRecord.originalFileName,
        mimeType: fileRecord.mimeType,
        size: fileRecord.size,
        originalSize,
        url: fileRecord.url,
        fileType: fileRecord.fileType,
        width: fileRecord.width,
        height: fileRecord.height,
        format: format || fileType.toLowerCase(),
        createdAt: fileRecord.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 목록 조회
 */
export async function getFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { resourceType, resourceId, folder, fileType } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const where: any = {
      tenantId: tenant.id,
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (folder) {
      where.folder = folder;
    }

    if (fileType) {
      where.fileType = fileType;
    }

    const skip = (page - 1) * limit;

    const [files, total] = await Promise.all([
      prisma.file.findMany({
        where,
        select: {
          id: true,
          fileName: true,
          originalFileName: true,
          mimeType: true,
          size: true,
          url: true,
          fileType: true,
          width: true,
          height: true,
          resourceType: true,
          resourceId: true,
          folder: true,
          createdAt: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.file.count({ where }),
    ]);

    res.json({
      data: files,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 상세 조회
 */
export async function getFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;

    const file = await prisma.file.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
    });

    if (!file) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    res.json({ data: file });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일 삭제
 */
export async function deleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { id } = req.params;

    // 파일 조회
    const file = await prisma.file.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
    });

    if (!file) {
      throw new AppError('파일을 찾을 수 없습니다.', 404);
    }

    // 권한 확인 (업로드한 사용자 또는 관리자만 삭제 가능)
    if (file.uploadedBy && file.uploadedBy !== req.user?.id && req.user?.role !== 'ADMIN') {
      throw new AppError('파일을 삭제할 권한이 없습니다.', 403);
    }

    // OCI에서 삭제
    try {
      await ociStorage.deleteFile(file.objectName);
    } catch (error) {
      console.error('Failed to delete from OCI:', error);
      // OCI 삭제 실패해도 DB에서는 삭제
    }

    // DB에서 삭제
    await prisma.file.delete({
      where: { id },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'file.deleted',
      tenantId: tenant.id,
      data: {
        fileId: file.id,
        fileName: file.fileName,
      },
    });

    res.json({ message: '파일이 삭제되었습니다.' });
  } catch (error) {
    next(error);
  }
}

/**
 * URL로 파일 삭제 (Internal API - 서비스간 통신용)
 * POST /internal/delete-by-url
 * Used by auth-service when avatar changes
 */
export async function deleteFileByUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { url } = req.body;

    if (!url) {
      throw new AppError('URL이 필요합니다.', 400);
    }

    // 파일 조회 by URL
    const file = await prisma.file.findFirst({
      where: {
        url,
        tenantId: tenant.id,
      },
    });

    if (!file) {
      // File not found in DB - might be external URL or already deleted
      console.log(`File not found for URL: ${url}`);
      res.json({ message: '파일을 찾을 수 없거나 이미 삭제되었습니다.', deleted: false });
      return;
    }

    // OCI에서 삭제
    try {
      await ociStorage.deleteFile(file.objectName);
      console.log(`Deleted file from OCI: ${file.objectName}`);
    } catch (error) {
      console.error('Failed to delete from OCI:', error);
      // OCI 삭제 실패해도 DB에서는 삭제
    }

    // DB에서 삭제
    await prisma.file.delete({
      where: { id: file.id },
    });

    // 이벤트 발행
    await eventPublisher.publish({
      eventType: 'file.deleted',
      tenantId: tenant.id,
      data: {
        fileId: file.id,
        fileName: file.fileName,
      },
    });

    res.json({ message: '파일이 삭제되었습니다.', deleted: true });
  } catch (error) {
    next(error);
  }
}

/**
 * URL로 파일 연결 (Internal API - 서비스간 통신용)
 * POST /internal/link-files
 * Used by blog-service when publishing posts to set resourceId for images
 */
export async function linkFilesByUrls(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);
    const { urls, resourceType, resourceId } = req.body as {
      urls: string[];
      resourceType: string;
      resourceId: string;
    };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      res.json({ message: 'No URLs provided', linked: 0 });
      return;
    }

    if (!resourceType || !resourceId) {
      throw new AppError('resourceType and resourceId are required', 400);
    }

    // Update files that match the URLs
    const result = await prisma.file.updateMany({
      where: {
        tenantId: tenant.id,
        url: { in: urls },
      },
      data: {
        resourceType,
        resourceId,
      },
    });

    console.log(`[Storage] Linked ${result.count} files to ${resourceType}:${resourceId}`);

    res.json({
      message: `${result.count} files linked`,
      linked: result.count,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Extract image URLs from HTML content
 */
function extractImageUrls(content: string | null, coverImage: string | null): string[] {
  const urls: string[] = [];

  if (coverImage) {
    urls.push(coverImage);
  }

  if (!content) return urls;

  // Extract from HTML img tags
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  // Extract from Markdown images
  const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

/**
 * 기존 게시글 이미지 마이그레이션 (Internal API - 일회성)
 * POST /internal/migrate-post-images
 * Fetches all posts from blog-service and links their images in the files table
 */
export async function migratePostImages(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    // Fetch all posts from blog-service
    const blogServiceUrl = process.env.BLOG_SERVICE_URL || 'http://blog-service:3002';
    const response = await fetch(`${blogServiceUrl}/internal/posts/all`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
        'x-tenant-id': tenant.id,
        'x-tenant-name': tenant.name,
      },
    });

    if (!response.ok) {
      throw new AppError(`Failed to fetch posts from blog-service: ${response.status}`, 500);
    }

    const result = await response.json() as {
      success: boolean;
      data: Array<{
        id: string;
        content: string;
        coverImage: string | null;
      }>;
    };

    const posts = result.data || [];
    let totalLinked = 0;
    const postResults: Array<{ postId: string; linked: number }> = [];

    // Process each post
    for (const post of posts) {
      const imageUrls = extractImageUrls(post.content, post.coverImage);

      if (imageUrls.length === 0) continue;

      // Update files that match the URLs
      const updateResult = await prisma.file.updateMany({
        where: {
          tenantId: tenant.id,
          url: { in: imageUrls },
        },
        data: {
          resourceType: 'POST',
          resourceId: post.id,
        },
      });

      if (updateResult.count > 0) {
        totalLinked += updateResult.count;
        postResults.push({ postId: post.id, linked: updateResult.count });
      }
    }

    console.log(`[Storage] Migration complete: linked ${totalLinked} files across ${postResults.length} posts`);

    res.json({
      message: 'Migration completed',
      postsProcessed: posts.length,
      postsWithImages: postResults.length,
      totalFilesLinked: totalLinked,
      details: postResults,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 파일/이미지 통계 조회 (Internal API)
 * GET /api/images/stats
 * Note: Avatars are managed separately (old deleted on new upload)
 */
export async function getImageStats(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    // Get detailed image URLs breakdown
    const imageUrlsData = await getDetailedImageUrls(tenant.id, tenant.name);

    // Count external images (URLs found in posts/drafts that are not from our storage)
    const externalUrls = Array.from(imageUrlsData.allUrls).filter((url) => isExternalUrl(url));

    // Get all unlinked files (exclude avatars - managed separately)
    const unlinkedFiles = await prisma.file.findMany({
      where: {
        tenantId: tenant.id,
        fileType: 'IMAGE',
        resourceId: null,
        folder: { not: 'avatars' },
      },
      select: { url: true, size: true },
    });

    // Calculate usedInDrafts breakdown
    const draftCoverFiles = unlinkedFiles.filter((file) => imageUrlsData.breakdown.draftCover.has(file.url));
    const draftContentFiles = unlinkedFiles.filter((file) => imageUrlsData.breakdown.draftContent.has(file.url));
    const usedInDrafts = unlinkedFiles.filter((file) => imageUrlsData.allUrls.has(file.url) && !imageUrlsData.breakdown.postCover.has(file.url) && !imageUrlsData.breakdown.postContent.has(file.url)).length;
    const orphanCandidates = unlinkedFiles.filter((file) => !imageUrlsData.allUrls.has(file.url));
    const orphaned = orphanCandidates.length;
    const orphanSize = orphanCandidates.reduce((sum, file) => sum + file.size, 0);

    // Exclude avatars from all stats (managed separately)
    const [total, linked, totalSizeResult] = await Promise.all([
      prisma.file.count({
        where: { tenantId: tenant.id, fileType: 'IMAGE', folder: { not: 'avatars' } },
      }),
      prisma.file.count({
        where: { tenantId: tenant.id, fileType: 'IMAGE', resourceId: { not: null }, folder: { not: 'avatars' } },
      }),
      prisma.file.aggregate({
        where: { tenantId: tenant.id, fileType: 'IMAGE', folder: { not: 'avatars' } },
        _sum: { size: true },
      }),
    ]);

    res.json({
      data: {
        total,
        totalSize: totalSizeResult._sum.size || 0,
        linked,
        usedInDrafts,
        orphaned,
        orphanSize,
        externalCount: externalUrls.length,
        externalUrls, // Return all external URLs
        // Detailed breakdown from blog-service
        breakdown: {
          postCover: imageUrlsData.counts.postCover,
          postContent: imageUrlsData.counts.postContent,
          draftCover: imageUrlsData.counts.draftCover,
          draftContent: imageUrlsData.counts.draftContent,
          // Files in our storage that are used in drafts (not yet linked to posts)
          draftCoverFiles: draftCoverFiles.length,
          draftContentFiles: draftContentFiles.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 고아 파일 목록 조회 (관리자 전용)
 * 리소스에 연결되지 않은 파일 (posts/drafts content/coverImage에서 사용되지 않음)
 * Excludes:
 * - Images used in draft content
 * - Avatar images (managed separately by users)
 */
export async function getOrphanFiles(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    // Fetch image URLs used in drafts from blog-service
    const draftImageUrls = await getDraftImageUrls(tenant.id, tenant.name);

    // 리소스에 연결되지 않은 파일 조회
    // Exclude 'avatars' folder - profile images are managed separately
    const candidates = await prisma.file.findMany({
      where: {
        tenantId: tenant.id,
        resourceId: null,
        folder: { not: 'avatars' },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out images used in drafts
    const orphans = candidates.filter((file) => !draftImageUrls.has(file.url));

    // Get all unlinked files for usedInDrafts calculation (exclude avatars)
    const allUnlinkedFiles = await prisma.file.findMany({
      where: { tenantId: tenant.id, resourceId: null, folder: { not: 'avatars' } },
      select: { url: true },
    });
    const usedInDrafts = allUnlinkedFiles.filter((file) => draftImageUrls.has(file.url)).length;

    // 통계 계산 (exclude avatars folder)
    const [total, linked, totalSizeResult] = await Promise.all([
      prisma.file.count({ where: { tenantId: tenant.id, folder: { not: 'avatars' } } }),
      prisma.file.count({ where: { tenantId: tenant.id, resourceId: { not: null }, folder: { not: 'avatars' } } }),
      prisma.file.aggregate({
        where: { tenantId: tenant.id, folder: { not: 'avatars' } },
        _sum: { size: true },
      }),
    ]);

    const orphanSize = orphans.reduce((sum, file) => sum + file.size, 0);

    // Get detailed breakdown
    const imageUrlsData = await getDetailedImageUrls(tenant.id, tenant.name);
    const externalUrls = Array.from(imageUrlsData.allUrls).filter((url) => isExternalUrl(url));

    // Calculate draft file breakdown
    const allUnlinkedFilesForBreakdown = await prisma.file.findMany({
      where: { tenantId: tenant.id, resourceId: null, folder: { not: 'avatars' } },
      select: { url: true },
    });
    const draftCoverFiles = allUnlinkedFilesForBreakdown.filter((file) => imageUrlsData.breakdown.draftCover.has(file.url));
    const draftContentFiles = allUnlinkedFilesForBreakdown.filter((file) => imageUrlsData.breakdown.draftContent.has(file.url));

    res.json({
      data: {
        orphans: orphans.map((file) => ({
          id: file.id,
          url: file.url,
          objectName: file.objectName,
          fileName: file.fileName,
          originalFileName: file.originalFileName,
          size: file.size,
          fileType: file.fileType,
          createdAt: file.createdAt.toISOString(),
        })),
        stats: {
          total,
          linked,
          usedInDrafts,
          orphaned: orphans.length,
          totalSize: totalSizeResult._sum.size || 0,
          orphanSize,
          externalCount: externalUrls.length,
          externalUrls,
          breakdown: {
            postCover: imageUrlsData.counts.postCover,
            postContent: imageUrlsData.counts.postContent,
            draftCover: imageUrlsData.counts.draftCover,
            draftContent: imageUrlsData.counts.draftContent,
            draftCoverFiles: draftCoverFiles.length,
            draftContentFiles: draftContentFiles.length,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DB와 버킷 동기화 (관리자 전용)
 * 버킷에 없는 파일의 DB 레코드를 삭제합니다.
 * POST /api/files/sync
 */
export async function syncFilesWithBucket(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    // DB에서 모든 파일 레코드 조회
    const dbFiles = await prisma.file.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, objectName: true, size: true },
    });

    if (dbFiles.length === 0) {
      res.json({
        data: {
          checked: 0,
          removed: 0,
          freedSpace: 0,
        },
      });
      return;
    }

    // 버킷에서 실제 존재 여부 확인 (병렬 처리)
    const existenceChecks = await Promise.allSettled(
      dbFiles.map(async (file) => {
        const exists = await ociStorage.fileExists(file.objectName);
        return { file, exists };
      })
    );

    // 버킷에 없는 파일 찾기
    const missingFiles: { id: string; objectName: string; size: number }[] = [];
    for (const result of existenceChecks) {
      if (result.status === 'fulfilled' && !result.value.exists) {
        missingFiles.push(result.value.file);
      }
    }

    // DB에서 누락된 파일 레코드 삭제
    if (missingFiles.length > 0) {
      await prisma.file.deleteMany({
        where: { id: { in: missingFiles.map((f) => f.id) } },
      });
    }

    const freedSpace = missingFiles.reduce((sum, f) => sum + f.size, 0);

    res.json({
      data: {
        checked: dbFiles.length,
        removed: missingFiles.length,
        freedSpace,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 고아 파일 일괄 삭제 (관리자 전용)
 * Excludes:
 * - Images used in draft content
 * - Avatar images (managed separately by users)
 */
export async function deleteOrphanFiles(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== 'ADMIN') {
      throw new AppError('관리자 권한이 필요합니다.', 403);
    }

    const tenant = req.tenant!;
    const prisma = tenantPrisma.getClient(tenant.id);

    // Fetch image URLs used in drafts from blog-service
    const draftImageUrls = await getDraftImageUrls(tenant.id, tenant.name);

    // 고아 파일 후보 조회 (exclude avatars folder)
    const candidates = await prisma.file.findMany({
      where: {
        tenantId: tenant.id,
        resourceId: null,
        folder: { not: 'avatars' },
      },
    });

    // Filter out images used in drafts
    const orphans = candidates.filter((file) => !draftImageUrls.has(file.url));

    if (orphans.length === 0) {
      res.json({
        data: {
          deleted: 0,
          freedSpace: 0,
          skippedInDrafts: candidates.length,
        },
      });
      return;
    }

    let freedSpace = 0;
    const deleteErrors: string[] = [];
    const successIds: string[] = [];

    // OCI에서 삭제 - PARALLEL execution for better performance
    const deleteResults = await Promise.allSettled(
      orphans.map(async (file) => {
        await ociStorage.deleteFile(file.objectName);
        return file;
      })
    );

    // Process results
    for (let i = 0; i < deleteResults.length; i++) {
      const result = deleteResults[i];
      const file = orphans[i];

      if (result.status === 'fulfilled') {
        freedSpace += file.size;
        successIds.push(file.id);
      } else {
        console.error(`Failed to delete from OCI: ${file.objectName}`, result.reason);
        deleteErrors.push(file.objectName);
      }
    }

    // DB에서 성공적으로 삭제된 파일만 제거
    if (successIds.length > 0) {
      await prisma.file.deleteMany({
        where: { id: { in: successIds } },
      });
    }

    res.json({
      data: {
        deleted: successIds.length,
        freedSpace,
        skippedInDrafts: candidates.length - orphans.length,
        errors: deleteErrors.length > 0 ? deleteErrors : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}
