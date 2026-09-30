import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
const source = await readFile(new URL('../../assets/js/like-counter.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function client({ blocked = false, loseResponse = false } = {}) {
  let state = { likes: 0, liked: false, revision: 0 };
  const requests = [];
  const nodes = new Map(['button', '[data-like-count]', '[data-like-heart]', '[data-like-status]'].map(key => [key, {
    textContent: '', disabled: true, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(event, fn) { this[event] = fn; },
  }]));
  const storage = new Map();
  runInNewContext(source, {
    document: { querySelectorAll: () => [{ dataset: { endpoint: 'https://api.example/api/likes', postId: '/posts/test/' }, querySelector: s => nodes.get(s) }] },
    window: { addEventListener() {} }, navigator: {}, URL, AbortSignal, crypto: { randomUUID },
    localStorage: { getItem(k) { if (blocked) throw Error(); return storage.get(k); }, setItem(k, v) { storage.set(k, v); } },
    fetch: async (url, options) => {
      requests.push(options.method);
      if (options.method === 'POST') {
        const input = JSON.parse(options.body);
        assert.equal(input.revision, state.revision);
        state = { liked: input.liked, likes: input.liked ? 1 : 0, revision: state.revision + 1 };
        if (loseResponse) { loseResponse = false; throw Error('Lost response after commit'); }
      }
      return { ok: true, status: 200, json: async () => ({ ...state }) };
    },
  });
  return { nodes, requests, state: () => state, click: () => nodes.get('button').click() };
}
test('like UI toggles and blocks duplicate clicks while a request is pending', async () => {
  const c = client(); await settle();
  c.click(); c.click(); await settle();
  assert.equal(c.state().likes, 1);
  assert.equal(c.requests.filter(x => x === 'POST').length, 1);
  assert.equal(c.nodes.get('button').attrs['aria-pressed'], 'true');
  c.click(); await settle();
  assert.equal(c.state().likes, 0);
});
test('a lost mutation response is recovered by reading without reversing the committed like', async () => {
  const c = client({ loseResponse: true }); await settle();
  c.click(); await settle();
  assert.match(c.nodes.get('[data-like-status]').textContent, /확인하지 못/);
  c.click(); await settle();
  assert.equal(c.state().likes, 1);
  assert.equal(c.requests.filter(x => x === 'POST').length, 1);
  assert.equal(c.nodes.get('button').attrs['aria-pressed'], 'true');
});
test('blocked browser storage allows counts but disables voting', async () => {
  const c = client({ blocked: true }); await settle();
  assert.equal(c.nodes.get('[data-like-count]').textContent, '0');
  assert.equal(c.nodes.get('button').disabled, true);
  assert.deepEqual(c.requests, ['GET']);
});
