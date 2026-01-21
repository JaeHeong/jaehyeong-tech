import app from './app';
import { prisma } from './services/prisma';
import { eventPublisher } from './services/eventPublisher';
import { ociStorage } from './services/ociStorage';

const PORT = process.env.PORT || 3006;

async function startServer() {
  try {
    // Prisma 연결 테스트
    await prisma.$connect();
    console.info('✅ Database connected');

    // RabbitMQ 연결
    await eventPublisher.connect();

    // OCI Object Storage 초기화
    await ociStorage.initialize();

    // 서버 시작
    app.listen(PORT, () => {
      console.info(`🚀 Storage Service running on port ${PORT}`);
      console.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.info(`🏥 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  await eventPublisher.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.info('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  await eventPublisher.disconnect();
  process.exit(0);
});

startServer();
