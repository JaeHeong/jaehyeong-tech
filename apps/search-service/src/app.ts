import express from 'express';
import cors from 'cors';
import { searchRouter } from './routes/search';
import { internalRouter } from './routes/internal';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'search-service' });
});

// Routes
app.use('/api/search', searchRouter);
app.use('/internal', internalRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

export default app;
