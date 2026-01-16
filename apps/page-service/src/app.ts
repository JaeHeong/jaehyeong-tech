import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { pageRouter } from './routes/page';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'page-service' });
});

app.get('/ready', async (_req: Request, res: Response) => {
  res.json({ status: 'ready', service: 'page-service' });
});

// Routes
app.use('/api/pages', pageRouter);

// Error handler (must be last)
app.use(errorHandler);

export default app;
