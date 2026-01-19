import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenant';
import userRoutes from './routes/user';
import authorRoutes from './routes/author';
import internalRoutes from './routes/internal';
import { errorHandler } from './middleware/errorHandler';
import { getJWKS } from './services/jwtService';

// 환경 변수 로드
dotenv.config();

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

app.get('/ready', (req, res) => {
  res.json({ status: 'ready', service: 'auth-service' });
});

// JWKS Endpoint (for Istio RequestAuthentication)
app.get('/.well-known/jwks.json', (req, res) => {
  res.json(getJWKS());
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/author', authorRoutes);

// Internal routes (service-to-service communication)
app.use('/internal', internalRoutes);

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
