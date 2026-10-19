const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchOptions, searchPosts } = require('../dist/modules/blog/controllers/search');
const { prisma } = require('../dist/db');

test('search always limits results to published posts for the configured blog', () => {
  const { where, page, limit } = searchOptions({ q: '쿠버네티스 Redis', tenantId: 'another' }, 'blog');
  assert.equal(where.tenantId, 'blog');
  assert.equal(where.status, 'PUBLIC');
  assert.equal(where.AND.length, 2);
  assert.equal(where.AND[0].OR[0].title.contains, '쿠버네티스');
  assert.equal(page, 1);
  assert.equal(limit, 10);
});

test('invalid pagination is rejected and sort fields are allowlisted', () => {
  for (const page of ['-1', '0', '1.5', 'NaN', '1000001']) assert.throws(() => searchOptions({ page }, 'blog'), error => error.statusCode === 400);
  assert.equal(searchOptions({ limit: '10000' }, 'blog').limit, 100);
  assert.deepEqual(searchOptions({ sortBy: 'content; DROP TABLE posts' }, 'blog').orderBy, [{ publishedAt: 'desc' }, { id: 'asc' }]);
});

test('search wildcards are literal and category/tag filters remain scoped', () => {
  const { where } = searchOptions({ q: '100% a_b', category: 'devops', tag: '쿠버네티스' }, 'blog');
  assert.equal(where.AND[0].OR[0].title.contains, '100\\%');
  assert.equal(where.AND[1].OR[0].title.contains, 'a\\_b');
  assert.deepEqual(where.category, { slug: 'devops' });
  assert.equal(where.tags.some.OR[1].slug, '쿠버네티스');
});

test('database failures produce an API error instead of an empty successful search', async () => {
  const original = prisma.$transaction;
  prisma.$transaction = async () => { throw new Error('database unavailable'); };
  let error;
  try {
    await searchPosts({query: {q: 'test'}, tenant: {id: 'blog'}}, {json() {assert.fail('must not succeed');}}, value => {error = value;});
    assert.match(error.message, /database unavailable/);
  } finally { prisma.$transaction = original; }
});
