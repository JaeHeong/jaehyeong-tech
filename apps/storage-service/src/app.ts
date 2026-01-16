import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import storageRoutes from './routes/storage';
import { errorHandler } from './middleware/errorHandler';

// 환경 변수 로드
dotenv.config();

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'storage-service', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.json({ status: 'ready', service: 'storage-service' });
});

// API Routes
app.use('/api/files', storageRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: 'Route not found',
  });
});

// Error Handler (마지막에 위치)
app.use(errorHandler);

export default app;
