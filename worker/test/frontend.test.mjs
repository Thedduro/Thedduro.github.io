import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../../assets/js/view-counter.js', import.meta.url), 'utf8');
const windowMs = 30 * 60 * 1000;
const now = 1800000000000;
const key = 'post-view:v2:/posts/example/';
async function render({ storage = new Map(), postId = '/posts/example/', time = now,
  denied = false, result = { views: 128 }, fails = false, ok = true, locks, responseDelay = 0, failOnce = false, mode = "visit", postIds } = {}) {
  const counter = { dataset: { endpoint: 'http://localhost:8787/api/views', postId, windowMinutes: '30', mode },
    hidden: true, setAttribute(name, value) { this[name] = value; } };
  const separator = { hidden: true, hasAttribute: () => true };
  counter.previousElementSibling = separator;
  const counters = postIds ? postIds.map(id => ({ ...counter, dataset: { ...counter.dataset, postId: id }, previousElementSibling: { ...separator } })) : [counter];
  const calls = [];
  let clock = time;
  vm.runInNewContext(source, {
    document: { querySelectorAll() { return counters; } },
    localStorage: { getItem(k) { if (denied) throw Error(); return storage.get(k) ?? null; },
      setItem(k, value) { if (denied) throw Error(); storage.set(k, value); } },
    navigator: locks ? { locks } : {}, URL, AbortSignal, crypto: webcrypto,
    Date: class extends Date { static now() { return clock; } },
    fetch: async (url, options) => { calls.push({ url, ...options }); clock += responseDelay; if (fails || (failOnce && calls.length === 1)) throw Error('offline');
      return { ok, json: async () => url.pathname.endsWith('/batch') ? { views: Object.fromEntries(url.searchParams.getAll('postId').map(id => [id, result.views])) } : result }; },
  });
  await new Promise(resolve => setImmediate(resolve));
  return { counter, counters, separator, calls, storage };
}
test('first visit POST renders count; revisit GET; 30 minutes POST; separate post POST', async () => {
  const storage = new Map();
  const first = await render({ storage });
  assert.equal(first.calls[0].method, 'POST');
  assert.equal(first.calls[0].url.searchParams.get('postId'), '/posts/example/');
  assert.equal(first.counter.textContent, '조회수 128');
  assert.equal(first.counter['aria-label'], '조회수 128');
  assert.equal(first.counter.hidden, false);
  assert.equal(first.separator.hidden, false);
  assert.equal((await render({ storage, time: now + windowMs - 1 })).calls[0].method, 'GET');
  assert.equal((await render({ storage, time: now + windowMs })).calls[0].method, 'POST');
  assert.equal((await render({ storage, postId: '/posts/other/' })).calls[0].method, 'POST');
});
test('unavailable storage uses GET; invalid/future timestamps recover', async () => {
  assert.equal((await render({ denied: true })).calls[0].method, 'GET');
  for (const value of ['invalid', '-1', String(now + 1)]) {
    assert.equal((await render({ storage: new Map([[key, JSON.stringify({lastCountedAt: value})]]) })).calls[0].method, 'POST');
  }
});
test('failed responses preserve pending ID and do not record success; reload reuses ID', async () => {
  for (const options of [{ fails: true }, { ok: false }, { result: { views: -1 } }, { result: { views: '12' } }]) {
    const first = await render(options);
    assert.equal(first.counter.hidden, true);
    assert.equal(first.separator.hidden, true);
    const pending = JSON.parse(first.storage.get(key));
    assert.ok(pending.pendingId);
    assert.equal(pending.lastCountedAt, undefined);
    for (const call of first.calls) assert.equal(call.headers['Idempotency-Key'], pending.pendingId);
    const retry = await render({ storage: first.storage, time: now + 10000 });
    assert.equal(retry.calls[0].method, 'POST');
    assert.equal(retry.calls[0].headers['Idempotency-Key'], pending.pendingId);
    assert.deepEqual(JSON.parse(first.storage.get(key)), { lastCountedAt: now + 10000 });
  }
});
test('successful visit creates a new ID only after the 30 minute window', async () => {
  const storage = new Map();
  const first = await render({ storage });
  const next = await render({ storage, time: now + windowMs });
  assert.notEqual(first.calls[0].headers['Idempotency-Key'], next.calls[0].headers['Idempotency-Key']);
});
test('same-origin tabs serialize storage checks through Web Locks', async () => {
  const storage = new Map();
  let queue = Promise.resolve();
  const locks = { request(_key, action) { queue = queue.then(action); return queue; } };
  const tabs = await Promise.all([render({ storage, locks }), render({ storage, locks })]);
  assert.deepEqual(tabs.map(tab => tab.calls[0].method), ['POST', 'GET']);
});

test('records response time and recovers a lost response with the same ID', async () => {
  const result = await render({ failOnce: true, responseDelay: 5000 });
  assert.equal(result.calls.length, 2);
  assert.equal(result.calls[0].headers['Idempotency-Key'], result.calls[1].headers['Idempotency-Key']);
  assert.deepEqual(JSON.parse(result.storage.get(key)), { lastCountedAt: now + 10000 });
  assert.equal(result.counter.textContent, '조회수 128');
});

test('list only GETs visible cards and never creates visit state', async () => {
  const result = await render({ mode: 'read', postIds: ['/posts/one/', '/posts/two/'] });
  assert.equal(result.calls.length, 1);
  assert.equal(result.calls[0].url.pathname, "/api/views/batch");
  assert.deepEqual(result.calls[0].url.searchParams.getAll("postId"), ["/posts/one/", "/posts/two/"]);
  assert.ok(result.calls.every(call => call.method === 'GET'));
  assert.ok(result.counters.every(counter => counter.textContent === '조회수 128' && !counter.previousElementSibling.hidden));
  assert.ok([...result.storage.keys()].every(key => key.startsWith('post-view-cache:')));
});
test('list cache lasts 10 minutes; detail still counts and updates list cache', async () => {
  const storage = new Map();
  await render({ storage, mode: 'read' });
  const cached = await render({ storage, mode: 'read', time: now + 599999 });
  assert.equal(cached.calls.length, 0);
  assert.equal(cached.counter.textContent, '조회수 128');
  assert.equal((await render({ storage, mode: 'read', time: now + 600000 })).calls[0].method, 'GET');
  const detail = await render({ storage, time: now + 610000, result: { views: 129 } });
  assert.equal(detail.calls[0].method, 'POST');
  const back = await render({ storage, mode: 'read', time: now + 620000 });
  assert.equal(back.calls.length, 0);
  assert.equal(back.counter.textContent, '조회수 129');
});
test('list does not retry pending visits and ignores corrupt cache', async () => {
  const storage = new Map([[key, JSON.stringify({ pendingId: webcrypto.randomUUID() })]]);
  const before = storage.get(key);
  const result = await render({ storage, mode: 'read', denied: true });
  assert.equal(result.calls[0].method, 'GET');
  assert.equal(storage.get(key), before);
});

test('batch only requests expired or missing IDs and deduplicates cards', async () => {
  const storage = new Map();
  await render({ storage, mode: 'read', postId: '/posts/one/' });
  const result = await render({ storage, mode: 'read', time: now + 1000,
    postIds: ['/posts/one/', '/posts/two/', '/posts/two/'] });
  assert.equal(result.calls.length, 1);
  assert.deepEqual(result.calls[0].url.searchParams.getAll('postId'), ['/posts/two/']);
  assert.ok(result.counters.every(c => c.textContent === '조회수 128'));
});
test('large lists split into bounded batches; failures leave counts hidden', async () => {
  const result = await render({ mode: 'read', postIds: Array.from({length: 51}, (_, i) => `/posts/post-${i}/`) });
  assert.equal(result.calls.length, 2);
  assert.equal(result.calls[0].url.searchParams.getAll('postId').length, 50);
  assert.equal(result.calls[1].url.searchParams.getAll('postId').length, 1);
  assert.ok(result.counters.every(c => !c.hidden));
  const failed = await render({ mode: 'read', fails: true });
  assert.equal(failed.counter.hidden, true);
  assert.equal(failed.storage.size, 0);
});
