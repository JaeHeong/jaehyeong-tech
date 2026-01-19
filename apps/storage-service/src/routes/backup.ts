/**
 * Backup Routes for Storage Service (MSA Pattern)
 *
 * Implements backup functionality following Kubernetes/Istio best practices:
 * - Service-to-service communication via internal APIs
 * - Each service manages its own data domain
 * - Storage service orchestrates data aggregation
 */
import { Router, IRouter, Request, Response, NextFunction } from 'express';
import { resolveTenant } from '../middleware/tenantResolver';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import { ociStorage } from '../services/ociStorage';
import { AppError } from '../middleware/errorHandler';
import '@shared/types/express';

const router: IRouter = Router();

// Service endpoints for internal communication
const SERVICE_ENDPOINTS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  blog: process.env.BLOG_SERVICE_URL || 'http://blog-service:3002',
  comment: process.env.COMMENT_SERVICE_URL || 'http://comment-service:3003',
  page: process.env.PAGE_SERVICE_URL || 'http://page-service:3004',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3005',
};

interface BackupData {
  version: string;
  description?: string;
  createdAt: string;
  tenantId: string;
  data: {
    // Auth service data
    users: unknown[];
    tenant?: unknown;
    // Blog service data
    posts: unknown[];
    drafts: unknown[];
    categories: unknown[];
    tags: unknown[];
    images: unknown[];
    // Comment service data
    comments: unknown[];
    // Page service data
    pages: unknown[];
    pageViews: unknown[];
    // Analytics service data
    siteVisitors: unknown[];
    bugReports: unknown[];
  };
}

/**
 * Fetch data from a service's internal export API
 */
async function fetchFromService(
  serviceName: string,
  serviceUrl: string,
  tenantId: string,
  tenantName: string
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const response = await fetch(`${serviceUrl}/internal/export`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-request': 'true',
        'x-tenant-id': tenantId,
        'x-tenant-name': tenantName,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Backup] Failed to fetch from ${serviceName}: ${response.status} - ${errorText}`);
      return { success: false, error: `${serviceName} returned ${response.status}` };
    }

    const result = await response.json() as { success: boolean; data: Record<string, unknown> };
    return { success: true, data: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Backup] Error fetching from ${serviceName}:`, message);
    return { success: false, error: message };
  }
}

// Apply tenant resolution and admin auth to all routes
router.use(resolveTenant);
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /api/backup
 * List all backups for the tenant
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ociStorage.isConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500);
    }

    const tenantName = req.tenant!.name;
    const objects = await ociStorage.listBackupObjects(tenantName);
    const backupFiles = objects.filter((name) => name.endsWith('.json'));

    // Parse backup info from filenames and fetch descriptions
    const backups = await Promise.all(
      backupFiles.map(async (fullPath) => {
        const fileName = fullPath.split('/').pop() || '';
        let createdAt: string | null = null;
        let description: string | null = null;

        // Extract timestamp from filename: backup_2024-01-15T10-30-00-000Z.json
        const match = fileName.match(/backup_(.+)\.json$/);
        if (match && match[1]) {
          try {
            const ts = match[1];
            const parsed = ts.replace(
              /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
              '$1T$2:$3:$4.$5Z'
            );
            const date = new Date(parsed);
            if (!isNaN(date.getTime())) {
              createdAt = date.toISOString();
            }
          } catch {
            // Ignore parsing errors
          }
        }

        // Try to read description from backup file
        try {
          const buffer = await ociStorage.downloadFromBackupBucket(fullPath);
          const backupData: BackupData = JSON.parse(buffer.toString('utf-8'));
          description = backupData.description || null;
        } catch {
          // Ignore errors reading backup file
        }

        return {
          name: fileName,
          fullPath,
          createdAt,
          description,
        };
      })
    );

    const sortedBackups = backups.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.json({ data: sortedBackups });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup
 * Create a new backup by aggregating data from all services
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ociStorage.isConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500);
    }

    const tenantId = req.tenant!.id;
    const tenantName = req.tenant!.name;
    const { description } = req.body as { description?: string };

    console.info(`[Backup] Starting backup for tenant: ${tenantName}`);

    // Fetch data from all services in parallel
    const [authResult, blogResult, commentResult, pageResult, analyticsResult] = await Promise.all([
      fetchFromService('auth', SERVICE_ENDPOINTS.auth, tenantId, tenantName),
      fetchFromService('blog', SERVICE_ENDPOINTS.blog, tenantId, tenantName),
      fetchFromService('comment', SERVICE_ENDPOINTS.comment, tenantId, tenantName),
      fetchFromService('page', SERVICE_ENDPOINTS.page, tenantId, tenantName),
      fetchFromService('analytics', SERVICE_ENDPOINTS.analytics, tenantId, tenantName),
    ]);

    // Check for any failures
    const failures: string[] = [];
    if (!authResult.success) failures.push(`auth: ${authResult.error}`);
    if (!blogResult.success) failures.push(`blog: ${blogResult.error}`);
    if (!commentResult.success) failures.push(`comment: ${commentResult.error}`);
    if (!pageResult.success) failures.push(`page: ${pageResult.error}`);
    if (!analyticsResult.success) failures.push(`analytics: ${analyticsResult.error}`);

    if (failures.length > 0) {
      throw new AppError(`백업 데이터 수집 실패: ${failures.join(', ')}`, 500);
    }

    // Aggregate all data
    const backupData: BackupData = {
      version: '2.0-msa',
      description: description || undefined,
      createdAt: new Date().toISOString(),
      tenantId,
      data: {
        // Auth service data
        users: (authResult.data?.users as unknown[]) || [],
        tenant: authResult.data?.tenant,
        // Blog service data
        posts: (blogResult.data?.posts as unknown[]) || [],
        drafts: (blogResult.data?.drafts as unknown[]) || [],
        categories: (blogResult.data?.categories as unknown[]) || [],
        tags: (blogResult.data?.tags as unknown[]) || [],
        images: (blogResult.data?.images as unknown[]) || [],
        // Comment service data
        comments: (commentResult.data?.comments as unknown[]) || [],
        // Page service data
        pages: (pageResult.data?.pages as unknown[]) || [],
        pageViews: (pageResult.data?.pageViews as unknown[]) || [],
        // Analytics service data
        siteVisitors: (analyticsResult.data?.siteVisitors as unknown[]) || [],
        bugReports: (analyticsResult.data?.bugReports as unknown[]) || [],
      },
    };

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${timestamp}.json`;

    // Upload to backup bucket
    const buffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8');
    const objectPath = await ociStorage.uploadToBackupBucket(tenantName, fileName, buffer, 'application/json');

    console.info(`[Backup] Backup completed: ${objectPath}`);

    res.json({
      data: {
        success: true,
        fileName,
        objectPath,
        createdAt: backupData.createdAt,
        stats: {
          users: backupData.data.users.length,
          posts: backupData.data.posts.length,
          drafts: backupData.data.drafts.length,
          categories: backupData.data.categories.length,
          tags: backupData.data.tags.length,
          images: backupData.data.images.length,
          comments: backupData.data.comments.length,
          pages: backupData.data.pages.length,
          pageViews: backupData.data.pageViews.length,
          siteVisitors: backupData.data.siteVisitors.length,
          bugReports: backupData.data.bugReports.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backup/:fileName/info
 * Get backup info (preview stats)
 */
router.get('/:fileName/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ociStorage.isConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500);
    }

    const { fileName } = req.params;
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400);
    }

    const tenantName = req.tenant!.name;
    const objectName = `${tenantName}/backups/${fileName}`;

    const buffer = await ociStorage.downloadFromBackupBucket(objectName);
    const backupData: BackupData = JSON.parse(buffer.toString('utf-8'));

    res.json({
      data: {
        fileName,
        version: backupData.version,
        description: backupData.description || null,
        createdAt: backupData.createdAt,
        tenantId: backupData.tenantId,
        stats: {
          users: backupData.data.users?.length || 0,
          posts: backupData.data.posts?.length || 0,
          drafts: backupData.data.drafts?.length || 0,
          categories: backupData.data.categories?.length || 0,
          tags: backupData.data.tags?.length || 0,
          images: backupData.data.images?.length || 0,
          comments: backupData.data.comments?.length || 0,
          pages: backupData.data.pages?.length || 0,
          pageViews: backupData.data.pageViews?.length || 0,
          siteVisitors: backupData.data.siteVisitors?.length || 0,
          bugReports: backupData.data.bugReports?.length || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backup/:fileName
 * Download backup file
 */
router.get('/:fileName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ociStorage.isConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500);
    }

    const { fileName } = req.params;
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400);
    }

    const tenantName = req.tenant!.name;
    const objectName = `${tenantName}/backups/${fileName}`;

    const buffer = await ociStorage.downloadFromBackupBucket(objectName);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/:fileName/restore
 * Restore from backup (MSA version - sends data to each service)
 *
 * Note: Full restore requires each service to implement internal restore endpoints.
 * This is a placeholder for the restore orchestration.
 */
router.post('/:fileName/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ociStorage.isConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500);
    }

    const { fileName } = req.params;
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400);
    }

    // Note: Full restore functionality requires each service to implement
    // /internal/restore endpoints. This is a complex operation that needs
    // careful orchestration to maintain data consistency across services.
    //
    // For now, return the backup data for manual restoration or provide
    // guidance on implementing the full restore flow.

    throw new AppError(
      '복원 기능은 MSA 환경에서 각 서비스별 internal/restore 엔드포인트 구현이 필요합니다. ' +
      '백업 파일을 다운로드하여 수동으로 복원하거나, 관리자에게 문의하세요.',
      501
    );
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/backup/:fileName
 * Delete backup file
 */
router.delete('/:fileName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!ociStorage.isConfigured()) {
      throw new AppError('OCI Object Storage가 설정되지 않았습니다.', 500);
    }

    const { fileName } = req.params;
    if (!fileName) {
      throw new AppError('파일명이 필요합니다.', 400);
    }

    const tenantName = req.tenant!.name;
    const objectName = `${tenantName}/backups/${fileName}`;

    await ociStorage.deleteFromBackupBucket(objectName);

    res.json({
      data: {
        success: true,
        message: '백업이 삭제되었습니다.',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
