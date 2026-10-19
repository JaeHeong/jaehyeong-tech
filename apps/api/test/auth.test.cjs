const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
process.env.JWT_PUBLIC_KEY = publicKey.export({ type: 'spki', format: 'pem' });
const { authenticate, optionalAuthenticate } = require('../dist/middleware/authenticate');
const { prisma } = require('../dist/db');
const tenant = { id: 'blog', domain: 'blog.example' };

test('legacy user headers cannot grant admin access', async () => {
  const req = { headers: { 'x-user-id': 'admin', 'x-user-role': 'ADMIN' }, tenant };
  let error;
  await authenticate(req, {}, value => { error = value; });
  assert.equal(error.statusCode, 401);
  assert.equal(req.user, undefined);
  await optionalAuthenticate(req, {}, () => {});
  assert.equal(req.user, undefined);
});

test('authenticated role is read from the active database user', async () => {
  const token = jwt.sign({ userId: 'user', tenantId: 'blog', role: 'ADMIN', email: 'old@example.test' }, privateKey,
    { algorithm: 'RS256', issuer: 'https://blog.example', audience: 'blog.example', expiresIn: '1h' });
  const original = prisma.user.findFirst;
  prisma.user.findFirst = async ({where}) => {
    assert.equal(where.status, 'ACTIVE');
    assert.equal(where.tenantId, 'blog');
    return {id: 'user', tenantId: 'blog', role: 'USER', email: 'current@example.test'};
  };
  try {
    const req = {headers: {authorization: `Bearer ${token}`}, tenant};
    let error;
    await authenticate(req, {}, value => {error = value;});
    assert.equal(error, undefined);
    assert.equal(req.user.role, 'USER');
  } finally {prisma.user.findFirst = original;}
});

test('tokens for another site are rejected before database access', async () => {
  const token = jwt.sign({userId: 'user', tenantId: 'another-site'}, privateKey,
    {algorithm: 'RS256', issuer: 'https://blog.example', audience: 'blog.example'});
  let error;
  await authenticate({headers: {authorization: `Bearer ${token}`}, tenant}, {}, value => {error = value;});
  assert.equal(error.statusCode, 403);
});
