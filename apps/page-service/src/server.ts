import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { prisma } from './services/prisma';
import { eventPublisher } from './services/eventPublisher';

const PORT = process.env.PORT || 3004;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.info('✅ Database connected');

    // Connect to RabbitMQ
    await eventPublisher.connect();

    // Start server
    app.listen(PORT, () => {
      console.info(`🚀 Page Service listening on port ${PORT}`);
      console.info(`   Health check: http://localhost:${PORT}/health`);
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
