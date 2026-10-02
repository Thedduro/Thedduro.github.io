(() => {
  const root = document.querySelector('[data-glossary]');
  if (!root) return;

  const query = root.querySelector('#glossary-query');
  const filters = [...root.querySelectorAll('button[data-tag]')];
  const results = root.querySelector('#glossary-results');
  const count = root.querySelector('[data-glossary-count]');
  const empty = root.querySelector('[data-glossary-empty]');
  const clear = root.querySelector('[data-clear-query]');
  const reset = root.querySelector('[data-reset-glossary]');
  const indexLinks = [...root.querySelectorAll('[data-index-key]')];
  // NFKC also makes decomposed Hangul and full-width Latin search consistently.
  const normalize = (value) => value.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/gu, '');
  const groups = [...results.querySelectorAll('[data-group]')].map((node) => ({
    node,
    count: node.querySelector('[data-group-count]'),
    entries: [...node.querySelectorAll('.glossary-entry')].map((entry) => ({
      node: entry,
      tags: JSON.parse(entry.dataset.tags),
      search: ['title', 'english', 'abbreviations', 'aliases', 'description'].map((key) => normalize(entry.dataset[key] || '')),
    })),
  }));
  let tag = '';
  let composing = false;

  function update() {
    const words = query.value.trim().split(/\s+/u).filter(Boolean).map(normalize);
    let visible = 0;
    for (const group of groups) {
      let groupVisible = 0;
      for (const entry of group.entries) {
        const matches = (!tag || entry.tags.includes(tag))
          && words.every((word) => entry.search.some((field) => field.includes(word)));
        entry.node.hidden = !matches;
        if (matches) groupVisible += 1;
      }
      group.node.hidden = groupVisible === 0;
      group.count.textContent = `${groupVisible}개`;
      visible += groupVisible;
      const link = indexLinks.find((item) => item.dataset.indexKey === group.node.dataset.group);
      if (link) {
        // Keep a consistent index, but make groups with no results unavailable.
        if (groupVisible) {
          link.href = `#${group.node.id}`;
          link.removeAttribute('aria-disabled');
          link.removeAttribute('tabindex');
        } else {
          link.removeAttribute('href');
          link.setAttribute('aria-disabled', 'true');
          link.setAttribute('tabindex', '-1');
        }
      }
    }
    count.textContent = words.length || tag ? `검색 결과 ${visible}개 용어` : `전체 ${visible}개 용어`;
    empty.hidden = visible !== 0;
    clear.hidden = query.value.length === 0;
    filters.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tag === tag)));
  }

  function resetFilters() {
    query.value = '';
    tag = '';
    update();
  }

  function revealHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !results.contains(target)) return;
    if (target.hidden || target.closest('[data-group]')?.hidden) resetFilters();
    // Wait for a previously filtered-out target to become visible.
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }

  root.querySelector('form').addEventListener('submit', (event) => event.preventDefault());
  query.addEventListener('compositionstart', () => { composing = true; });
  query.addEventListener('compositionend', () => { composing = false; update(); });
  query.addEventListener('input', () => { if (!composing) update(); });
  filters.forEach((button) => button.addEventListener('click', () => {
    tag = button.dataset.tag === tag ? '' : button.dataset.tag;
    update();
  }));
  clear.addEventListener('click', () => { query.value = ''; update(); query.focus(); });
  reset.addEventListener('click', () => { resetFilters(); query.focus(); });
  window.addEventListener('hashchange', revealHash);

  update();
  root.querySelector('[data-glossary-controls]').hidden = false;
  reset.hidden = false;
  revealHash();
})();
