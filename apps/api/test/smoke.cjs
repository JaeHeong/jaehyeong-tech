// Read-only smoke checks against an existing database. Run explicitly with DATABASE_URL.
const assert = require('node:assert/strict');
const { prisma } = require('../dist/db');
const app = require('../dist/app').default;
const { generateToken } = require('../dist/modules/auth/services/jwtService');
const { closeRedisConnection } = require('@shared/utils');

(async () => {
  let server;
  try {
    await prisma.$executeRawUnsafe('SET default_transaction_read_only = on');
    const tenant = await prisma.tenant.findUnique({where: {id: process.env.TENANT_ID || 'tenant-jaehyeong-tech'}});
    const admin = await prisma.user.findFirst({where: {tenantId: tenant.id, role: 'ADMIN', status: 'ACTIVE'}});
    const before = await prisma.post.count({where: {tenantId: tenant.id, status: 'PUBLIC'}});
    const token = generateToken(tenant, admin.id, admin.role, admin.email);
    server = await new Promise(resolve => {const s = app.listen(0, '127.0.0.1', () => resolve(s));});
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/health','/ready','/api/posts?limit=2','/api/categories','/api/tags','/api/author','/api/pages?type=NOTICE','/api/search?q=쿠버네티스','/api/search?q=Redis','/rss.xml','/sitemap.xml']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
      if (path.startsWith('/api/search')) {
        const data = await response.json();
        assert.ok(Array.isArray(data.data));
        assert.ok(data.data.every(post => post.status === 'PUBLIC'));
        console.log(path, 'results:', data.pagination.total);
      } else console.log(path, response.status);
    }
    const all = await (await fetch(base + '/api/search?limit=1')).json();
    assert.equal(all.pagination.total, before);
    for (const path of ['/api/auth/me','/api/stats/dashboard','/api/images/stats','/api/comments/admin','/api/drafts']) {
      const response = await fetch(base + path, {headers: {Authorization: `Bearer ${token}`}});
      assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`);
      console.log(path, response.status);
    }
    const spoofed = await fetch(base + '/api/drafts', {headers: {'x-user-id':admin.id,'x-user-role':'ADMIN'}});
    assert.equal(spoofed.status, 401);
    const invalid = await fetch(base + '/api/search?page=-1');
    assert.equal(invalid.status, 400);
    assert.equal(await prisma.post.count({where: {tenantId: tenant.id, status: 'PUBLIC'}}), before);
    console.log('Read-only API smoke checks passed; published posts:', before);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await closeRedisConnection();
    await prisma.$disconnect();
  }
})().catch(error => {console.error(error.message);process.exitCode=1;});
