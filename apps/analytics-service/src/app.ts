import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { visitorRouter } from './routes/visitor';
import { bugReportRouter } from './routes/bugReport';
import { statsRouter } from './routes/stats';
import { analyticsRouter } from './routes/analytics';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'analytics-service' });
});

app.get('/ready', async (_req: Request, res: Response) => {
  res.json({ status: 'ready', service: 'analytics-service' });
});

// Routes
app.use('/api/visitors', visitorRouter);
app.use('/api/bug-reports', bugReportRouter);
app.use('/api/stats', statsRouter);
app.use('/api/analytics', analyticsRouter);

// Error handler (must be last)
app.use(errorHandler);

export default app;
