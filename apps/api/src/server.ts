import 'dotenv/config';
import app from './app';
import { prisma } from './db';
import { siteId } from './middleware/tenantResolver';
import { ociStorage } from './modules/storage/services/ociStorage';
import { closeRedisConnection } from '@shared/utils';

async function start() {
  await prisma.$connect();
  if (!await prisma.tenant.findUnique({ where: { id: siteId } })) {
    throw new Error('The configured blog site does not exist');
  }
  await ociStorage.initialize();
  const server = app.listen(Number(process.env.PORT || 3000), () => {
    console.info('Blog API started');
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.close(() => {
      Promise.all([prisma.$disconnect(), closeRedisConnection()])
        .then(() => process.exit(0)).catch(() => process.exit(1));
    });
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
start().catch((error) => { console.error('API startup failed:', error); process.exit(1); });
