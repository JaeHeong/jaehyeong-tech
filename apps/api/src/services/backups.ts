import * as auth from '../modules/auth/services/backup';
import * as blog from '../modules/blog/services/backup';
import * as comment from '../modules/comment/services/backup';
import * as page from '../modules/page/services/backup';
import * as analytics from '../modules/analytics/services/backup';

const domains = { auth, blog, comment, page, analytics };
type Domain = keyof typeof domains;

export async function exportDomain(name: Domain, siteId: string): Promise<{
  success: boolean; data?: Record<string, unknown>; error?: string;
}> {
  try {
    const result = await domains[name].exportData(siteId);
    return { success: true, data: result.data };
  } catch (error) {
    console.error(`Backup export failed: ${name}`, error);
    return { success: false, error: `Failed to export ${name}` };
  }
}

export async function restoreDomain(name: Domain, siteId: string, data: Record<string, unknown>): Promise<{
  success: boolean; data?: Record<string, unknown>; error?: string;
}> {
  try {
    const result = await domains[name].restoreData(siteId, data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error(`Backup restore failed: ${name}`, error);
    return { success: false, error: `Failed to restore ${name}` };
  }
}

import { ociStorage } from '../modules/storage/services/ociStorage';

export async function listBackups(tenantName: string) {
  if (!ociStorage.isConfigured()) return [];
  const objects = await ociStorage.listBackupObjects(tenantName);
  return objects.filter(name => name.endsWith('.json')).sort().reverse().map(fullPath => {
    const name = fullPath.split('/').pop()!;
    const stamp = name.match(/^backup_(.+)\.json$/)?.[1];
    const parsed = stamp?.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1T$2:$3:$4.$5Z');
    const date = parsed ? new Date(parsed) : null;
    return { name, fullPath, createdAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null, description: null };
  });
}
