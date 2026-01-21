import amqp from 'amqplib';
import { Event, PostCreatedEvent, PostUpdatedEvent, PostDeletedEvent, PostPublishedEvent } from '@shared/events';
import { meilisearchService, PostDocument } from './meilisearch';

// Environment prefix for exchange namespacing (dev/prod isolation)
const ENV_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const BLOG_SERVICE_URL = process.env.BLOG_SERVICE_URL || 'http://jaehyeong-tech-prod-blog:3002';

// Strip HTML tags from content for indexing
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
    .replace(/&nbsp;/g, ' ')   // Replace nbsp
    .replace(/&[a-z]+;/gi, ' ') // Replace other HTML entities
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

// Fetch full post data from blog-service internal API
async function fetchPostData(postId: string, tenantId: string): Promise<PostDocument | null> {
  try {
    const response = await fetch(
      `${BLOG_SERVICE_URL}/internal/posts/${postId}`,
      {
        headers: {
          'x-internal-request': 'true',
          'x-tenant-id': tenantId,
        },
      }
    );

    if (!response.ok) {
      console.warn(`⚠️ Post not found: ${postId}`);
      return null;
    }

    interface BlogPost {
      id: string;
      tenantId: string;
      slug: string;
      title: string;
      excerpt?: string;
      content?: string;
      coverImage?: string | null;
      categoryId: string;
      category?: { name: string; slug: string };
      tags?: { name: string }[];
      authorId: string;
      author?: { name: string };
      status: string;
      publishedAt?: string;
      createdAt: string;
      updatedAt: string;
      viewCount?: number;
      likeCount?: number;
    }
    const result = await response.json() as { data: BlogPost };
    const post = result.data;

    return {
      id: post.id,
      tenantId: post.tenantId,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt || '',
      content: stripHtml(post.content || ''),
      coverImage: post.coverImage || null,
      categoryId: post.categoryId,
      categoryName: post.category?.name || '',
      categorySlug: post.category?.slug || '',
      tags: post.tags?.map((t) => t.name) || [],
      authorId: post.authorId,
      authorName: post.author?.name || '',
      status: post.status,
      publishedAt: post.publishedAt ? new Date(post.publishedAt).getTime() : null,
      createdAt: new Date(post.createdAt).getTime(),
      updatedAt: new Date(post.updatedAt).getTime(),
      viewCount: post.viewCount || 0,
      likeCount: post.likeCount || 0,
    };
  } catch (error) {
    console.error(`❌ Failed to fetch post ${postId}:`, error);
    return null;
  }
}

class EventConsumer {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: Awaited<ReturnType<Awaited<ReturnType<typeof amqp.connect>>['createChannel']>> | null = null;
  private readonly exchangeName = `msa-events-${ENV_PREFIX}`;
  private readonly queueName = `search-service-${ENV_PREFIX}`;

  async connect() {
    try {
      const rabbitmqUrl = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      // Ensure exchange exists
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      // Create queue for this service
      await this.channel.assertQueue(this.queueName, {
        durable: true,
        // Dead letter exchange for failed messages
        arguments: {
          'x-dead-letter-exchange': `${this.exchangeName}-dlx`,
        },
      });

      // Bind to post events
      const routingKeys = [
        'post.created',
        'post.updated',
        'post.deleted',
        'post.published',
      ];

      for (const key of routingKeys) {
        await this.channel.bindQueue(this.queueName, this.exchangeName, key);
        console.info(`📥 Bound to: ${key}`);
      }

      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

      console.info('✅ RabbitMQ consumer connected');
    } catch (error) {
      console.error('❌ RabbitMQ connection failed:', error);
      throw error;
    }
  }

  async startConsuming() {
    if (!this.channel) {
      throw new Error('RabbitMQ not connected');
    }

    console.info('🎧 Starting to consume events...');

    await this.channel.consume(
      this.queueName,
      async (msg) => {
        if (!msg) return;

        try {
          const event = JSON.parse(msg.content.toString()) as Event;
          console.info(`📨 Received event: ${event.eventType} (${event.eventId})`);

          await this.handleEvent(event);

          // Acknowledge message
          this.channel!.ack(msg);
        } catch (error) {
          console.error('❌ Failed to process event:', error);

          // Reject and requeue (or send to DLQ after retries)
          this.channel!.nack(msg, false, false);
        }
      },
      { noAck: false }
    );
  }

  private async handleEvent(event: Event) {
    switch (event.eventType) {
      case 'post.created':
        await this.handlePostCreated(event as PostCreatedEvent);
        break;

      case 'post.updated':
        await this.handlePostUpdated(event as PostUpdatedEvent);
        break;

      case 'post.deleted':
        await this.handlePostDeleted(event as PostDeletedEvent);
        break;

      case 'post.published':
        await this.handlePostPublished(event as PostPublishedEvent);
        break;

      default:
        console.warn(`⚠️ Unknown event type: ${(event as Event).eventType}`);
    }
  }

  private async handlePostCreated(event: PostCreatedEvent) {
    const { postId } = event.data;
    const tenantId = event.tenantId;

    const postDoc = await fetchPostData(postId, tenantId);
    if (postDoc) {
      // Only index published posts
      if (postDoc.status === 'PUBLIC') {
        await meilisearchService.indexPost(postDoc);
      } else {
        console.info(`⏭️ Skipping non-public post: ${postId} (${postDoc.status})`);
      }
    }
  }

  private async handlePostUpdated(event: PostUpdatedEvent) {
    const { postId } = event.data;
    const tenantId = event.tenantId;

    const postDoc = await fetchPostData(postId, tenantId);
    if (postDoc) {
      if (postDoc.status === 'PUBLIC') {
        await meilisearchService.updatePost(postDoc);
      } else {
        // If post is no longer public, remove from index
        await meilisearchService.deletePost(postId);
        console.info(`🗑️ Removed non-public post from index: ${postId}`);
      }
    }
  }

  private async handlePostDeleted(event: PostDeletedEvent) {
    const { postId } = event.data;
    await meilisearchService.deletePost(postId);
  }

  private async handlePostPublished(event: PostPublishedEvent) {
    const { postId } = event.data;
    const tenantId = event.tenantId;

    const postDoc = await fetchPostData(postId, tenantId);
    if (postDoc) {
      await meilisearchService.indexPost(postDoc);
    }
  }

  async disconnect() {
    try {
      await this.channel?.close();
      await this.connection?.close();
      console.info('✅ RabbitMQ consumer disconnected');
    } catch (error) {
      console.error('❌ RabbitMQ disconnection error:', error);
    }
  }
}

export const eventConsumer = new EventConsumer();
