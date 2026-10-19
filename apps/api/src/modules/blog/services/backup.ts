import { tenantPrisma } from '../../../db';

export async function exportData(siteId: string) {
  try {
    const prisma = tenantPrisma.getClient(siteId);

    // Fetch all data in parallel
    const [posts, drafts, categories, tags, likes, bookmarks, postViews] = await Promise.all([
      prisma.post.findMany({
        include: {
          category: true,
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.draft.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.tag.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.like.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bookmark.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.postView.findMany({
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        posts,
        drafts,
        categories,
        tags,
        likes,
        bookmarks,
        postViews,
      },
      meta: {
        counts: {
          posts: posts.length,
          drafts: drafts.length,
          categories: categories.length,
          tags: tags.length,
          likes: likes.length,
          bookmarks: bookmarks.length,
          postViews: postViews.length,
        },
        exportedAt: new Date().toISOString(),
        tenantId: siteId,
      },
    };
  } catch (error) {
    throw error;
  }
}

export async function restoreData(siteId: string, input: unknown) {
  try {
    const prisma = tenantPrisma.getClient(siteId);
    const { posts, drafts, categories, tags, likes, bookmarks, postViews } = input as {
      posts?: Array<{
        id: string;
        tenantId: string;
        slug: string;
        title: string;
        excerpt: string;
        content: string;
        coverImage?: string | null;
        viewCount: number;
        likeCount: number;
        readingTime: number;
        status: 'DRAFT' | 'PUBLIC' | 'PRIVATE';
        featured: boolean;
        publishedAt?: string | null;
        authorId: string;
        categoryId: string;
        category?: { id: string; name: string } | null;
        tags?: Array<{ id: string; name: string; slug: string }>;
        createdAt: string;
        updatedAt: string;
      }>;
      drafts?: Array<{
        id: string;
        tenantId: string;
        title?: string | null;
        content: string;
        excerpt?: string | null;
        coverImage?: string | null;
        categoryId?: string | null;
        tagIds: string[];
        authorId: string;
        createdAt: string;
        updatedAt: string;
      }>;
      categories?: Array<{
        id: string;
        tenantId: string;
        name: string;
        slug: string;
        description?: string | null;
        icon?: string | null;
        color?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      tags?: Array<{
        id: string;
        tenantId: string;
        name: string;
        slug: string;
        createdAt: string;
        updatedAt: string;
      }>;
      likes?: Array<{
        id: string;
        tenantId: string;
        postId: string;
        ipHash: string;
        userId?: string | null;
        createdAt: string;
      }>;
      bookmarks?: Array<{
        id: string;
        tenantId: string;
        postId: string;
        userId: string;
        createdAt: string;
      }>;
      postViews?: Array<{
        id: string;
        tenantId: string;
        postId: string;
        ipHash: string;
        userId?: string | null;
        createdAt: string;
      }>;
    };

    const results = {
      categories: { deleted: 0, restored: 0, skipped: 0 },
      tags: { deleted: 0, restored: 0, skipped: 0 },
      posts: { deleted: 0, restored: 0, skipped: 0 },
      drafts: { deleted: 0, restored: 0, skipped: 0 },
      likes: { deleted: 0, restored: 0, skipped: 0 },
      bookmarks: { deleted: 0, restored: 0, skipped: 0 },
      postViews: { deleted: 0, restored: 0, skipped: 0 },
    };

    const tenantId = siteId;

    // 1. Delete existing data (order matters due to FK constraints)
    // Delete in reverse dependency order: views/likes/bookmarks -> posts -> drafts -> categories/tags
    const deletedPostViews = await prisma.postView.deleteMany({ where: { tenantId } });
    const deletedLikes = await prisma.like.deleteMany({ where: { tenantId } });
    const deletedBookmarks = await prisma.bookmark.deleteMany({ where: { tenantId } });
    const deletedPosts = await prisma.post.deleteMany({ where: { tenantId } });
    const deletedDrafts = await prisma.draft.deleteMany({ where: { tenantId } });
    const deletedCategories = await prisma.category.deleteMany({ where: { tenantId } });
    const deletedTags = await prisma.tag.deleteMany({ where: { tenantId } });

    results.posts.deleted = deletedPosts.count;
    results.drafts.deleted = deletedDrafts.count;
    results.categories.deleted = deletedCategories.count;
    results.tags.deleted = deletedTags.count;
    results.likes.deleted = deletedLikes.count;
    results.bookmarks.deleted = deletedBookmarks.count;
    results.postViews.deleted = deletedPostViews.count;
    console.info(`[Restore] Deleted blog data for tenant ${tenantId}: ${deletedPosts.count} posts, ${deletedDrafts.count} drafts, ${deletedCategories.count} categories, ${deletedTags.count} tags, ${deletedPostViews.count} views, ${deletedLikes.count} likes, ${deletedBookmarks.count} bookmarks`);

    // 2. Restore categories first (posts depend on them)
    if (categories && Array.isArray(categories)) {
      for (const category of categories) {
        try {
          await prisma.category.create({
            data: {
              id: category.id,
              tenantId: category.tenantId,
              name: category.name,
              slug: category.slug,
              description: category.description,
              icon: category.icon,
              color: category.color,
              createdAt: new Date(category.createdAt),
              updatedAt: new Date(),
            },
          });
          results.categories.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore category ${category.id}:`, error);
          results.categories.skipped++;
        }
      }
    }

    // 3. Restore tags (posts depend on them)
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        try {
          await prisma.tag.create({
            data: {
              id: tag.id,
              tenantId: tag.tenantId,
              name: tag.name,
              slug: tag.slug,
              createdAt: new Date(tag.createdAt),
              updatedAt: new Date(),
            },
          });
          results.tags.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore tag ${tag.id}:`, error);
          results.tags.skipped++;
        }
      }
    }

    // 4. Restore posts (with category and tag relationships)
    if (posts && Array.isArray(posts)) {
      for (const post of posts) {
        try {
          const tagIds = post.tags?.map(t => t.id) || [];
          await prisma.post.create({
            data: {
              id: post.id,
              tenantId: post.tenantId,
              slug: post.slug,
              title: post.title,
              excerpt: post.excerpt,
              content: post.content,
              coverImage: post.coverImage,
              viewCount: post.viewCount,
              likeCount: post.likeCount,
              readingTime: post.readingTime,
              status: post.status,
              featured: post.featured,
              publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
              authorId: post.authorId,
              categoryId: post.categoryId,
              tags: {
                connect: tagIds.map(id => ({ id })),
              },
              createdAt: new Date(post.createdAt),
              updatedAt: new Date(),
            },
          });
          results.posts.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore post ${post.id}:`, error);
          results.posts.skipped++;
        }
      }
    }

    // 5. Restore drafts
    if (drafts && Array.isArray(drafts)) {
      for (const draft of drafts) {
        try {
          await prisma.draft.create({
            data: {
              id: draft.id,
              tenantId: draft.tenantId,
              title: draft.title,
              content: draft.content,
              excerpt: draft.excerpt,
              coverImage: draft.coverImage,
              authorId: draft.authorId,
              categoryId: draft.categoryId,
              tagIds: draft.tagIds || [],
              createdAt: new Date(draft.createdAt),
              updatedAt: new Date(),
            },
          });
          results.drafts.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore draft ${draft.id}:`, error);
          results.drafts.skipped++;
        }
      }
    }

    // 6. Restore likes (after posts exist)
    if (likes && Array.isArray(likes)) {
      for (const like of likes) {
        try {
          await prisma.like.create({
            data: {
              id: like.id,
              tenantId: like.tenantId,
              postId: like.postId,
              ipHash: like.ipHash,
              userId: like.userId,
              createdAt: new Date(like.createdAt),
            },
          });
          results.likes.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore like ${like.id}:`, error);
          results.likes.skipped++;
        }
      }
    }

    // 7. Restore bookmarks (after posts exist)
    if (bookmarks && Array.isArray(bookmarks)) {
      for (const bookmark of bookmarks) {
        try {
          await prisma.bookmark.create({
            data: {
              id: bookmark.id,
              tenantId: bookmark.tenantId,
              postId: bookmark.postId,
              userId: bookmark.userId,
              createdAt: new Date(bookmark.createdAt),
            },
          });
          results.bookmarks.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore bookmark ${bookmark.id}:`, error);
          results.bookmarks.skipped++;
        }
      }
    }

    // 8. Restore postViews (after posts exist)
    if (postViews && Array.isArray(postViews)) {
      for (const view of postViews) {
        try {
          await prisma.postView.create({
            data: {
              id: view.id,
              tenantId: view.tenantId,
              postId: view.postId,
              ipHash: view.ipHash,
              userId: view.userId || null,
              createdAt: new Date(view.createdAt),
            },
          });
          results.postViews.restored++;
        } catch (error) {
          console.error(`[Restore] Failed to restore postView ${view.id}:`, error);
          results.postViews.skipped++;
        }
      }
    }

    return {
      success: true,
      data: results,
      meta: {
        restoredAt: new Date().toISOString(),
        tenantId: siteId,
      },
    };
  } catch (error) {
    throw error;
  }
}
