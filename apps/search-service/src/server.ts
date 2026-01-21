import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { meilisearchService } from './services/meilisearch';
import { eventConsumer } from './services/eventConsumer';

const PORT = process.env.PORT || 3007;

async function startServer() {
  try {
    // Connect to Meilisearch
    await meilisearchService.connect();

    // Connect to RabbitMQ and start consuming events
    await eventConsumer.connect();
    await eventConsumer.startConsuming();

    // Start HTTP server
    app.listen(PORT, () => {
      console.info(`🚀 Search Service listening on port ${PORT}`);
      console.info(`   Health check: http://localhost:${PORT}/health`);
      console.info(`   Search API: http://localhost:${PORT}/api/search`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.info('SIGTERM received, shutting down gracefully...');
  await eventConsumer.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.info('SIGINT received, shutting down gracefully...');
  await eventConsumer.disconnect();
  process.exit(0);
});

startServer();
