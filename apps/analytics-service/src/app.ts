import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import { visitorRouter } from './routes/visitor';
import { bugReportRouter } from './routes/bugReport';
import { ga4Router } from './routes/ga4';

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
app.use('/api/analytics', ga4Router);

// Error handler (must be last)
app.use(errorHandler);

export default app;
