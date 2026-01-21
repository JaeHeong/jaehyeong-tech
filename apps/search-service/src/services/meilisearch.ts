import { MeiliSearch, Index } from 'meilisearch';

// Post document structure for Meilisearch
export interface PostDocument {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;  // Full text content (HTML stripped)
  coverImage: string | null;  // Cover image URL
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tags: string[];  // Tag names for filtering
  authorId: string;
  authorName: string;
  status: string;
  publishedAt: number | null;  // Unix timestamp for filtering/sorting
  createdAt: number;
  updatedAt: number;
  viewCount: number;
  likeCount: number;
}

// Environment prefix for index namespacing (dev/prod isolation)
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

class MeilisearchService {
  private client: MeiliSearch | null = null;
  private postsIndex: Index<PostDocument> | null = null;
  private readonly indexName = `posts-${ENV_PREFIX}`;

  async connect() {
    try {
      const host = process.env.MEILISEARCH_HOST || 'http://meilisearch.meilisearch:7700';
      const apiKey = process.env.MEILISEARCH_API_KEY;

      if (!apiKey) {
        throw new Error('MEILISEARCH_API_KEY is required');
      }

      this.client = new MeiliSearch({ host, apiKey });

      // Test connection
      await this.client.health();
      console.info('✅ Meilisearch connected');

      // Initialize posts index
      await this.initializeIndex();
    } catch (error) {
      console.error('❌ Meilisearch connection failed:', error);
      throw error;
    }
  }

  private async initializeIndex() {
    if (!this.client) throw new Error('Meilisearch not connected');

    // Create or get index
    try {
      this.postsIndex = this.client.index<PostDocument>(this.indexName);

      // Configure index settings
      await this.postsIndex.updateSettings({
        // Searchable fields (order matters for relevance)
        searchableAttributes: [
          'title',
          'excerpt',
          'content',
          'categoryName',
          'tags',
          'authorName',
        ],

        // Filterable fields
        filterableAttributes: [
          'tenantId',
          'categoryId',
          'categorySlug',
          'tags',
          'status',
          'authorId',
          'publishedAt',
        ],

        // Sortable fields
        sortableAttributes: [
          'publishedAt',
          'createdAt',
          'updatedAt',
          'viewCount',
          'likeCount',
        ],

        // Displayed attributes (what's returned in search results)
        displayedAttributes: [
          'id',
          'tenantId',
          'slug',
          'title',
          'excerpt',
          'content',
          'coverImage',
          'categoryId',
          'categoryName',
          'categorySlug',
          'tags',
          'authorId',
          'authorName',
          'status',
          'publishedAt',
          'createdAt',
          'updatedAt',
          'viewCount',
          'likeCount',
        ],

        // Ranking rules
        rankingRules: [
          'words',
          'typo',
          'proximity',
          'attribute',
          'sort',
          'exactness',
        ],

        // Typo tolerance
        typoTolerance: {
          enabled: true,
          minWordSizeForTypos: {
            oneTypo: 4,
            twoTypos: 8,
          },
        },

        // Pagination
        pagination: {
          maxTotalHits: 1000,
        },
      });

      console.info(`✅ Meilisearch index '${this.indexName}' initialized`);
    } catch (error) {
      console.error('❌ Failed to initialize index:', error);
      throw error;
    }
  }

  async indexPost(post: PostDocument): Promise<void> {
    if (!this.postsIndex) throw new Error('Posts index not initialized');

    try {
      await this.postsIndex.addDocuments([post], { primaryKey: 'id' });
      console.info(`📝 Indexed post: ${post.id} (${post.title})`);
    } catch (error) {
      console.error(`❌ Failed to index post ${post.id}:`, error);
      throw error;
    }
  }

  async updatePost(post: PostDocument): Promise<void> {
    if (!this.postsIndex) throw new Error('Posts index not initialized');

    try {
      await this.postsIndex.updateDocuments([post], { primaryKey: 'id' });
      console.info(`📝 Updated post: ${post.id} (${post.title})`);
    } catch (error) {
      console.error(`❌ Failed to update post ${post.id}:`, error);
      throw error;
    }
  }

  async deletePost(postId: string): Promise<void> {
    if (!this.postsIndex) throw new Error('Posts index not initialized');

    try {
      await this.postsIndex.deleteDocument(postId);
      console.info(`🗑️ Deleted post from index: ${postId}`);
    } catch (error) {
      console.error(`❌ Failed to delete post ${postId}:`, error);
      throw error;
    }
  }

  async search(
    query: string,
    options: {
      tenantId: string;
      page?: number;
      limit?: number;
      categorySlug?: string;
      tag?: string;
      sortBy?: 'relevance' | 'publishedAt' | 'viewCount' | 'likeCount';
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    if (!this.postsIndex) throw new Error('Posts index not initialized');

    const { tenantId, page = 1, limit = 10, categorySlug, tag, sortBy, sortOrder = 'desc' } = options;

    // Build filter
    const filters: string[] = [
      `tenantId = "${tenantId}"`,
      `status = "PUBLIC"`,
    ];

    if (categorySlug) {
      filters.push(`categorySlug = "${categorySlug}"`);
    }

    if (tag) {
      filters.push(`tags = "${tag}"`);
    }

    // Build sort
    let sort: string[] | undefined;
    if (sortBy && sortBy !== 'relevance') {
      sort = [`${sortBy}:${sortOrder}`];
    }

    try {
      const result = await this.postsIndex.search(query, {
        filter: filters.join(' AND '),
        sort,
        offset: (page - 1) * limit,
        limit,
        attributesToHighlight: ['title', 'excerpt', 'content'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        showMatchesPosition: true,
      });

      return {
        hits: result.hits,
        total: result.estimatedTotalHits || 0,
        page,
        limit,
        processingTimeMs: result.processingTimeMs,
      };
    } catch (error) {
      console.error('❌ Search failed:', error);
      throw error;
    }
  }

  async bulkIndex(posts: PostDocument[]): Promise<void> {
    if (!this.postsIndex) throw new Error('Posts index not initialized');

    try {
      const task = await this.postsIndex.addDocuments(posts, { primaryKey: 'id' });
      console.info(`📦 Bulk indexing ${posts.length} posts (task: ${task.taskUid})`);

      // Wait for task to complete
      await this.client!.waitForTask(task.taskUid);
      console.info(`✅ Bulk indexing completed`);
    } catch (error) {
      console.error('❌ Bulk indexing failed:', error);
      throw error;
    }
  }

  async getStats() {
    if (!this.postsIndex) throw new Error('Posts index not initialized');

    try {
      return await this.postsIndex.getStats();
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      throw error;
    }
  }
}

export const meilisearchService = new MeilisearchService();
