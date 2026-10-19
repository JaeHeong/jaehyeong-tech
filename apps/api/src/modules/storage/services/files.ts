import { prisma } from '../../../db';
import { ociStorage } from './ociStorage';

export async function deleteStoredFile(tenantId: string, url: string) {
  const file = await prisma.file.findFirst({ where: { tenantId, url } });
  if (!file) return;
  await ociStorage.deleteFile(file.objectName);
  await prisma.file.delete({ where: { id: file.id } });
}

export async function getImageReferences(tenantId: string) {
  const [posts, drafts] = await Promise.all([
    prisma.post.findMany({ where: { tenantId }, select: { content: true, coverImage: true } }),
    prisma.draft.findMany({ where: { tenantId }, select: { content: true, coverImage: true } }),
  ]);
  const breakdown = {
    postCover: new Set<string>(), postContent: new Set<string>(),
    draftCover: new Set<string>(), draftContent: new Set<string>(),
  };
  for (const [items, cover, content] of [
    [posts, breakdown.postCover, breakdown.postContent],
    [drafts, breakdown.draftCover, breakdown.draftContent],
  ] as const) {
    for (const item of items) {
      if (item.coverImage) cover.add(item.coverImage);
      for (const match of item.content.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) content.add(match[1]);
      for (const match of item.content.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) content.add(match[1]);
    }
  }
  const allUrls = new Set(Object.values(breakdown).flatMap(set => [...set]));
  const counts = {
    postCover: breakdown.postCover.size, postContent: breakdown.postContent.size,
    draftCover: breakdown.draftCover.size, draftContent: breakdown.draftContent.size,
  };
  return { allUrls, breakdown, counts };
}
