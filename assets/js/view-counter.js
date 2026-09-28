(() => {
  const counters = Array.from(document.querySelectorAll('[data-view-counter]'));
  const cacheMs = 10 * 60 * 1000;

  async function processCounter(counter) {

    const postId = counter.dataset.postId;
    // v1 recorded attempts, not confirmed visits, so it cannot seed this state.
    const key = `post-view:v2:${postId}`;
    const minutes = Number(counter.dataset.windowMinutes);
    const windowMs = (Number.isFinite(minutes) && minutes > 0 ? minutes : 30) * 60 * 1000;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    async function update() {
      const url = new URL(counter.dataset.endpoint);
      url.searchParams.set('postId', postId);
      let requestId;
      try {
        let state;
        try { state = JSON.parse(localStorage.getItem(key)); } catch { state = null; }
        const last = state?.lastCountedAt;
        const recent = Number.isFinite(last) && last > 0 && last <= Date.now() && Date.now() - last < windowMs;
        if (uuid.test(state?.pendingId)) {
          requestId = state.pendingId;
        } else if (!recent) {
          requestId = crypto.randomUUID();
          // Persist before transmission so reloads can reuse an uncertain request.
          localStorage.setItem(key, JSON.stringify({ pendingId: requestId }));
        }
      } catch {
        requestId = undefined; // No durable browser state: only read the counter.
      }

      let views;
      for (let attempt = 0; attempt < (requestId ? 2 : 1); attempt++) {
        try {
          const response = await fetch(url, {
            method: requestId ? 'POST' : 'GET',
            headers: requestId ? { 'Idempotency-Key': requestId } : {},
            mode: 'cors', credentials: 'omit', cache: 'no-store',
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            if (response.status >= 500) continue;
            return;
          }
          const body = await response.json();
          if (!Number.isSafeInteger(body.views) || body.views < 0) return;
          views = body.views;
          if (requestId) {
            try {
              const state = JSON.parse(localStorage.getItem(key));
              if (state?.pendingId === requestId) {
                // A single write both clears pending and records confirmed success.
                localStorage.setItem(key, JSON.stringify({ lastCountedAt: Date.now() }));
              }
            } catch { /* Keep the pending ID if recording success fails. */ }
          }
          break;
        } catch { /* Retry once with the same ID; keep it for the next visit. */ }
      }
      if (views === undefined) return;
      save(counter, views);
      show(counter, views);
    }

    const run = navigator.locks ? navigator.locks.request(key, update) : update();
    await run.catch(() => { /* The optional counter must never break the article. */ });
  }

  function cacheKey(counter) {
    return `post-view-cache:v1:${counter.dataset.endpoint}:${counter.dataset.postId}`;
  }
  function cached(counter) {
    try {
      const value = JSON.parse(localStorage.getItem(cacheKey(counter)));
      const age = Date.now() - value?.savedAt;
      if (Number.isSafeInteger(value?.views) && value.views >= 0 && age >= 0 && age < cacheMs) return value;
    } catch { /* Fetch when cache is inaccessible or corrupt. */ }
  }
  function save(counter, views) {
    try { localStorage.setItem(cacheKey(counter), JSON.stringify({ views, savedAt: Date.now() })); }
    catch { /* Display works without storage. */ }
  }
  function show(counter, views) {
    counter.textContent = `조회수 ${views.toLocaleString('ko-KR')}`;
    counter.setAttribute('aria-label', `조회수 ${views.toLocaleString('ko-KR')}`);
    counter.hidden = false;
    const separator = counter.previousElementSibling;
    if (separator?.hasAttribute('data-view-counter-separator')) separator.hidden = false;
  }

  async function loadList(endpoint, cards) {
    // One request for the uncached IDs; split only large lists (50 IDs / ~7 KB URL).
    const pending = new Map();
    for (const counter of cards) {
      const value = cached(counter);
      if (value) show(counter, value.views);
      else {
        const id = counter.dataset.postId;
        if (!pending.has(id)) pending.set(id, []);
        pending.get(id).push(counter);
      }
    }
    const ids = [...pending.keys()];
    while (ids.length) {
      const url = new URL(endpoint);
      url.pathname = url.pathname.replace(/\/$/, '') + '/batch';
      url.search = '';
      const batch = [];
      while (ids.length && batch.length < 50) {
        const candidate = new URL(url);
        candidate.searchParams.append('postId', ids[0]);
        if (batch.length && candidate.href.length > 7000) break;
        url.search = candidate.search;
        batch.push(ids.shift());
      }
      const startedAt = Date.now();
      try {
        const response = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit',
          cache: 'no-store', signal: AbortSignal.timeout(8000) });
        if (!response.ok) continue;
        const body = await response.json();
        for (const id of batch) {
          const views = body?.views?.[id];
          if (!Number.isSafeInteger(views) || views < 0) continue;
          for (const counter of pending.get(id)) {
            // Do not replace a detail page's newer result with an older list response.
            const newer = cached(counter);
            if (newer && newer.savedAt > startedAt) show(counter, newer.views);
            else { save(counter, views); show(counter, views); }
          }
        }
      } catch { /* Leave unavailable counts hidden; preserve the rest of the list. */ }
    }
  }

  const lists = new Map();
  for (const counter of counters) {
    if (counter.dataset.mode === 'read') {
      const endpoint = counter.dataset.endpoint;
      if (!lists.has(endpoint)) lists.set(endpoint, []);
      lists.get(endpoint).push(counter);
    } else processCounter(counter).catch(() => {});
  }
  for (const [endpoint, cards] of lists) loadList(endpoint, cards).catch(() => {});
})();
