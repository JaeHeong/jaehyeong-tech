import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { postRouter } from './routes/post';
import { categoryRouter } from './routes/category';
import { tagRouter } from './routes/tag';
import { bookmarkRouter } from './routes/bookmark';
import { draftRouter } from './routes/draft';
import { seoRouter } from './routes/seo';
import { likeRouter } from './routes/like';
import { internalRouter } from './routes/internal';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'blog-service' });
});

app.get('/ready', async (_req: Request, res: Response) => {
  res.json({ status: 'ready', service: 'blog-service' });
});

// Routes
app.use('/api/posts', postRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/tags', tagRouter);
app.use('/api/bookmarks', bookmarkRouter);
app.use('/api/likes', likeRouter);
app.use('/api/drafts', draftRouter);

// SEO routes (served at root level)
app.use('/', seoRouter);

// Internal routes (service-to-service communication)
app.use('/internal', internalRouter);

// Error handler (must be last)
app.use(errorHandler);

export default app;
