const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const { setImmediate: tick } = require('node:timers/promises');

function fixture(mode = 'ready') {
  let attempts = 0;
  const keys = [];
  class Client extends EventEmitter {
    isOpen = false;
    isReady = false;
    async connect() {
      this.isOpen = true;
      if (mode === 'unreachable') return new Promise(() => {});
      this.isReady = true;
    }
    unref() {}
    async disconnect() { this.isOpen = this.isReady = false; }
    async get(key) { keys.push(key); return mode === 'stalled' ? new Promise(() => {}) : '{"value":42}'; }
    async setEx(key, ttl, value) { keys.push(key); assert.equal(ttl, 60); assert.equal(value, '{"value":1}'); }
    async del(key) { keys.push(key); }
    async mGet() { throw new Error('connection lost'); }
  }
  const client = new Client();
  const original = Module._load;
  Module._load = function(name, ...args) {
    return name === 'redis' ? { createClient(options) {
      attempts++;
      assert.equal(options.disableOfflineQueue, true);
      assert.equal(options.socket.reconnectStrategy, false);
      return client;
    } } : original.call(this, name, ...args);
  };
  let cache;
  try {
    delete require.cache[require.resolve('../dist/redis.js')];
    cache = require('../dist/redis.js');
  } finally { Module._load = original; }
  return { ...cache, client, keys, attempts: () => attempts };
}

test('unreachable Redis does not block origin reads or retry for each request', async () => {
  const f = fixture('unreachable'), cache = new f.CacheService('blog');
  const start = performance.now();
  for (let i = 0; i < 20; i++) assert.equal(await cache.getOrSet('post', async () => 'origin'), 'origin');
  assert.ok(performance.now() - start < 200);
  assert.equal(f.attempts(), 1);
  await f.closeRedisConnection();
});

test('ready cache uses project, environment and service key prefixes', async () => {
  const f = fixture(), cache = new f.CacheService('blog');
  await cache.get('post');
  await tick();
  assert.deepEqual(await cache.get('post'), { value: 42 });
  await cache.set('post', { value: 1 });
  assert.deepEqual(f.keys, ['jaehyeong-tech:dev:blog:post', 'jaehyeong-tech:dev:blog:post']);
  await f.closeRedisConnection();
});

test('stalled Redis commands have a deadline and subsequent requests bypass the cache', async () => {
  const f = fixture('stalled'), cache = new f.CacheService('blog');
  await cache.get('post');
  await tick();
  const start = performance.now();
  assert.equal(await cache.getOrSet('post', async () => 'origin'), 'origin');
  assert.ok(performance.now() - start < 500);
  assert.equal(f.client.isOpen, false);
  for (let i = 0; i < 10; i++) assert.equal(await cache.get('post'), null);
  assert.equal(f.attempts(), 1);
  await f.closeRedisConnection();
});

test('cache failures do not swallow origin errors', async () => {
  const f = fixture('unreachable'), cache = new f.CacheService('blog');
  await assert.rejects(cache.getOrSet('post', async () => { throw new Error('database failed'); }), /database failed/);
  assert.deepEqual(await cache.mget(['a', 'b']), [null, null]);
  await f.closeRedisConnection();
});
