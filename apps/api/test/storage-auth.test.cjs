const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
process.env.JWT_PUBLIC_KEY = publicKey.export({type: 'spki', format: 'pem'});
const files = require('../dist/modules/storage/routes/storage').default;
const {errorHandler} = require('../dist/middleware/errorHandler');
const {prisma} = require('../dist/db');
const tenant = {id: 'blog', name: 'blog', domain: 'blog.example'};
let server, base;
const originals = {user: prisma.user.findFirst, file: prisma.file.findFirst, delete: prisma.file.delete};
const ownedFile = {id: 'another-file', tenantId: 'blog', uploadedBy: 'another-user', url: 'https://files.example/another.png'};
function token(id, role) {
  return jwt.sign({userId: id, tenantId: tenant.id, role}, privateKey,
    {algorithm: 'RS256', issuer: 'https://blog.example', audience: 'blog.example', expiresIn: '1h'});
}
const adminToken = token('admin', 'ADMIN');
const userToken = token('user', 'USER');
before(async () => {
  prisma.user.findFirst = async ({where}) => ({id: where.id, tenantId: tenant.id, email: '', role: where.id === 'admin' ? 'ADMIN' : 'USER'});
  prisma.file.findFirst = async ({where}) => where.id === ownedFile.id || where.url === ownedFile.url ? ownedFile : null;
  prisma.file.delete = async () => {assert.fail('Tests must not delete any files');};
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {req.tenant = tenant; next();});
  app.use('/api/files', files);
  app.use(errorHandler);
  server = await new Promise(resolve => {const s = app.listen(0, '127.0.0.1', () => resolve(s));});
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  prisma.user.findFirst = originals.user;
  prisma.file.findFirst = originals.file;
  prisma.file.delete = originals.delete;
  await prisma.$disconnect();
});

test('file deletion verifies a valid token before checking the target', async () => {
  const response = await fetch(base + '/api/files/missing', {method: 'DELETE', headers: {Authorization: `Bearer ${adminToken}`}});
  assert.equal(response.status, 404);
});

test('URL deletion accepts an authenticated request for an absent file', async () => {
  const response = await fetch(base + '/api/files/delete-by-url', {
    method: 'POST', headers: {Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({url: 'https://files.example/missing.png'}),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).deleted, false);
});

test('unauthenticated and spoofed headers cannot delete files', async () => {
  for (const headers of [{}, {'x-user-id':'admin','x-user-role':'ADMIN'}]) {
    const response = await fetch(base + '/api/files/missing', {method: 'DELETE', headers});
    assert.equal(response.status, 401);
  }
});

test('members cannot delete another user’s file by ID or URL', async () => {
  const headers = {Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json'};
  const byId = await fetch(base + '/api/files/' + ownedFile.id, {method: 'DELETE', headers});
  assert.equal(byId.status, 403);
  const byUrl = await fetch(base + '/api/files/delete-by-url', {method: 'POST', headers, body: JSON.stringify({url: ownedFile.url})});
  assert.equal(byUrl.status, 403);
});
