import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';

const origin = 'https://thedduro.github.io';
const storage = await mkdtemp(join(tmpdir(), 'view-counter-test-'));
let child, base, port, logs = '';
async function stop() {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await exited;
}
async function start() {
  child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local',
    '--ip', '127.0.0.1', '--port', String(port), '--persist-to', storage], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, CLOUDFLARE_SEND_METRICS: 'false', CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  for (let i = 0; i < 150; i++) {
    if (child.exitCode !== null) throw new Error(logs);
    try {
      if ((await fetch(`${base}/ready`, { signal: AbortSignal.timeout(500) })).status === 404) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Local Worker did not start: ${logs}`);
}
before(async () => {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  await start();
});
after(async () => { await stop(); await rm(storage, { recursive: true, force: true }); });

async function request(postId, method = 'GET', headers = { Origin: origin }) {
  return fetch(`${base}/api/views?${new URLSearchParams({ postId })}`, { method, headers: { ...(method === 'POST' ? { 'Idempotency-Key': randomUUID() } : {}), ...headers } });
}
async function views(postId, method = 'GET') {
  const response = await request(postId, method);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  return (await response.json()).views;
}

test('GET does not increment; POST increments; IDs are independent and canonicalized', async () => {
  assert.equal(await views('/posts/first/'), 0);
  assert.equal(await views('/posts/first/', 'POST'), 1);
  assert.equal(await views('/posts/first/'), 1);
  assert.equal(await views('/posts/first', 'POST'), 2);
  assert.equal(await views('/posts/second/', 'POST'), 1);
  assert.equal(await views('/posts/first/'), 2);
  assert.equal(await views('/posts/한글/', 'POST'), 1);
  assert.equal(await views('/posts/%ED%95%9C%EA%B8%80/'), 1);
});
test('50 concurrent POSTs lose no increments', async () => {
  const results = await Promise.all(Array.from({ length: 50 }, () => views('/posts/concurrent/', 'POST')));
  assert.deepEqual(results.sort((a, b) => a - b), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(await views('/posts/concurrent/'), 50);
});
test('invalid or duplicated postId, routes and methods return JSON errors', async () => {
  for (const id of ['', '/posts/', 'https://example.com/posts/a/', '/posts/../', '/posts/a/b/',
    '/posts/a/?x=1', '/posts/%ZZ/', '/posts/a%2Fb/', `/posts/${'a'.repeat(1024)}/`]) {
    const response = await request(id, 'POST');
    assert.equal(response.status, 400, id);
    assert.ok((await response.json()).error);
  }
  for (const path of ['/api/views', '/api/views?postId=/posts/a/&postId=/posts/b/']) {
    assert.equal((await fetch(base + path)).status, 400);
  }
  assert.equal((await fetch(`${base}/missing`)).status, 404);
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    const response = await request('/posts/first/', method);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, POST, OPTIONS');
    assert.ok((await response.json()).error);
  }
});
test('production CORS rejects foreign/local/null Origins before mutation and supports preflight', async () => {
  for (const badOrigin of ['https://evil.example', 'http://localhost:1313', 'null']) {
    const response = await request('/posts/blocked/', 'POST', { Origin: badOrigin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(await views('/posts/blocked/'), 0);
  const preflight = await request('/posts/first/', 'OPTIONS', {
    Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, idempotency-key',
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Idempotency-Key/i);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
  assert.equal((await request('/posts/first/', 'OPTIONS', {
    Origin: origin, 'Access-Control-Request-Method': 'DELETE',
  })).status, 405);
  assert.equal((await request('/posts/first/', 'OPTIONS', {
    Origin: origin, 'Access-Control-Request-Headers': 'authorization',
  })).status, 400);
  assert.equal((await request('/posts/first/', 'GET', {})).status, 200);
});
test('SQLite data survives a local Worker process restart', async () => {
  assert.equal(await views('/posts/persistent/', 'POST'), 1);
  await stop();
  await start();
  assert.equal(await views('/posts/persistent/'), 1);
  assert.equal(await views('/posts/persistent/', 'POST'), 2);
});
test('storage failure returns a generic JSON 503 with CORS', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  // Inject only the failing binding; the public fetch handler is the actual source.
  const source = (await readFile(new URL('../src/index.ts', import.meta.url), 'utf8'))
    .replace('import { DurableObject } from "cloudflare:workers";', 'class DurableObject {}');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2024 } });
  const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
  const response = await worker.fetch(new Request(`${base}/api/views?postId=/posts/error/`, {
    headers: { Origin: origin },
  }), { ALLOWED_ORIGINS: origin, MY_DURABLE_OBJECT: { getByName() { throw new Error('simulated storage failure'); } } });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(await response.json(), { error: 'View counter temporarily unavailable' });
  assert.equal(log.mock.callCount(), 1);
});

test('same request ID counts once under concurrent retries and survives restart', async () => {
  const id = randomUUID();
  const post = () => request('/posts/idempotent/', 'POST', { Origin: origin, 'Idempotency-Key': id });
  const responses = await Promise.all(Array.from({ length: 20 }, post));
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal((await response.json()).views, 1);
  }
  await stop();
  await start();
  assert.equal((await (await post()).json()).views, 1);
  assert.equal(await views('/posts/idempotent/', 'POST'), 2);
  assert.equal((await (await post()).json()).views, 2);
  const independent = await request('/posts/idempotent-other/', 'POST', { 'Idempotency-Key': id });
  assert.equal((await independent.json()).views, 1);
});
test('POST requires a valid idempotency key, and key casing is canonical', async () => {
  for (const id of ['', 'bad', 'x'.repeat(1000)]) {
    assert.equal((await request('/posts/key-validation/', 'POST', { 'Idempotency-Key': id })).status, 400);
  }
  const missing = await fetch(`${base}/api/views?postId=/posts/key-validation/`, { method: 'POST' });
  assert.equal(missing.status, 400);
  const id = randomUUID();
  for (const key of [id, id.toUpperCase()]) {
    const response = await request('/posts/key-validation/', 'POST', { 'Idempotency-Key': key });
    assert.equal((await response.json()).views, 1);
  }
});

test('batch GET returns each count without increments and accepts encoded IDs', async () => {
  await views('/posts/batch-a/', 'POST');
  const ids = ['/posts/batch-a/', '/posts/batch-b/', '/posts/한글/'];
  const query = new URLSearchParams();
  ids.forEach(id => query.append('postId', id));
  const response = await fetch(`${base}/api/views/batch?${query}`, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json();
  assert.deepEqual(result.views, { '/posts/batch-a/': 1, '/posts/batch-b/': 0, '/posts/한글/': 1 });
  assert.equal(await views('/posts/batch-a/'), 1);
  assert.equal(await views('/posts/batch-b/'), 0);
});
test('batch validates size and every ID, rejects POST and forbidden Origin', async () => {
  for (const ids of [[], ['/posts/ok/', '/wrong/'], Array(51).fill('/posts/a/')]) {
    const query = new URLSearchParams();
    ids.forEach(id => query.append('postId', id));
    assert.equal((await fetch(`${base}/api/views/batch?${query}`)).status, 400);
  }
  assert.equal((await fetch(`${base}/api/views/batch?postId=/posts/a/`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${base}/api/views/batch?postId=/posts/a/`, { headers: { Origin: 'https://evil.example' } })).status, 403);
  const preflight = await fetch(`${base}/api/views/batch`, { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'GET, OPTIONS');
});
