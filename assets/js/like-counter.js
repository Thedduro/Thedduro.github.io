(() => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const element of document.querySelectorAll('[data-like-counter]')) {
    const button = element.querySelector('button');
    const count = element.querySelector('[data-like-count]');
    const heart = element.querySelector('[data-like-heart]');
    const status = element.querySelector('[data-like-status]');
    const url = new URL(element.dataset.endpoint);
    url.searchParams.set('postId', element.dataset.postId);
    const key = `post-like-visitor:v1:${url.origin}`;
    let visitorId;
    let state;
    let busy = false;

    function identity() {
      try {
        let id = localStorage.getItem(key);
        if (!uuid.test(id)) {
          id = crypto.randomUUID();
          localStorage.setItem(key, id);
        }
        return id;
      } catch { return undefined; }
    }
    async function request(input) {
      const response = await fetch(url, {
        method: input ? 'POST' : 'GET',
        headers: input ? { 'Content-Type': 'application/json' } : {},
        body: input ? JSON.stringify(input) : undefined,
        mode: 'cors', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
      if (!response.ok && response.status !== 409) throw new Error('Unavailable');
      const value = await response.json();
      if (!Number.isSafeInteger(value.likes) || value.likes < 0 || typeof value.liked !== 'boolean' ||
          !Number.isSafeInteger(value.revision) || value.revision < 0) throw new Error('Invalid response');
      state = value;
      count.textContent = value.likes.toLocaleString('ko-KR');
      heart.textContent = value.liked ? '♥' : '♡';
      button.setAttribute('aria-pressed', String(value.liked));
      return response.status;
    }
    async function run(change = false) {
      if (busy) return;
      busy = true;
      button.disabled = true;
      try {
        const update = async () => {
          visitorId = identity();
          url.searchParams.delete('visitorId');
          if (visitorId) url.searchParams.set('visitorId', visitorId);
          // Read the current revision inside the cross-tab lock before changing it.
          await request();
          if (change && visitorId) {
            const code = await request({ liked: !state.liked, revision: state.revision });
            status.textContent = code === 409 ? '다른 창의 변경을 반영했습니다. 다시 눌러 주세요.' :
              state.liked ? '좋아요를 눌렀습니다.' : '좋아요를 취소했습니다.';
          } else status.textContent = visitorId ? '' : '브라우저 저장소를 허용하면 좋아요를 누를 수 있습니다.';
        };
        if (navigator.locks) await navigator.locks.request(key, update);
        else await update();
      } catch {
        // Never claim success after an uncertain response; the next click reads first.
        state = undefined;
        status.textContent = '좋아요를 확인하지 못했습니다. 버튼을 눌러 다시 불러오세요.';
      } finally {
        busy = false;
        button.disabled = !visitorId;
      }
    }
    button.addEventListener('click', () => run(Boolean(state)));
    window.addEventListener('focus', () => run());
    run();
  }
})();
