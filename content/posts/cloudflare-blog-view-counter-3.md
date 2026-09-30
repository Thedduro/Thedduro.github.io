---
title: "Cloudflare로 GitHub Pages 블로그에 조회수 붙이기 - 3편"
date: 2026-09-28T15:05:22+09:00
draft: false
description: "Hugo에 조회수를 표시하고 중복 제한, 목록 일괄 조회와 캐시를 구현한다. Cloudflare Workers와 GitHub Pages 배포까지 연결한다."
slug: "cloudflare-blog-view-counter-3"
categories: ["Cloud"]
tags: ["Cloud", "Cloudflare", "Hugo", "JavaScript", "GitHub Pages"]
---

2편까지는 요청을 보내면 조회수를 저장하고 반환하는 API를 만들었다. 이제 블로그에 연결해 **글을 열면 조회수를 집계하고, 글 목록에서는 저장된 숫자만 보여주도록** 만든다.

배포할 대상은 두 개다. API는 Cloudflare Workers에, HTML과 JavaScript는 GitHub Pages에 올린다. 한쪽만 배포하면 화면과 API가 서로 다른 버전으로 남을 수 있다. 마지막에는 이 부분을 실제로 확인하는 방법까지 다룬다.

## 1. 30분 중복 제한과 10분 캐시 구분하기

두 시간은 서로 다른 목적으로 사용한다.

| 기준 | 무엇을 결정하나 | 적용 위치 |
| --- | --- | --- |
| 30분 | 같은 브라우저에서 같은 글을 다시 집계할지 | 게시글 상세 화면 |
| 10분 | 목록의 조회수를 다시 가져올지 | 글 목록 |

예를 들어 14시에 글을 읽고 집계가 성공했다면, 14시 10분에 같은 글을 다시 열어도 조회수를 올리지 않는다. 다만 GET으로 현재 숫자는 확인한다. 14시 30분 이후 다시 열면 새 집계 요청을 보낸다.

목록은 다르게 동작한다. 14시에 가져온 숫자는 10분 동안 재사용한다. 시간이 지나면 다음 목록 로딩 때 다시 조회한다. **10분마다 자동으로 요청하는 타이머를 두는 것은 아니다.** 그동안 다른 사람이 방문했다면 목록의 숫자는 잠시 뒤처질 수 있다.

### 이번 편에서 수정할 파일

1·2편의 `worker/` 프로젝트와, GitHub Pages로 배포할 수 있는 Hugo 블로그가 준비되어 있다고 가정한다. 예제 기준은 Node.js 24.21.0, Wrangler 4.136.1, Hugo 0.164.0이다.

| 파일 | 작업 |
| --- | --- |
| `worker/src/index.ts` | 여러 글의 조회수를 한 번에 반환하는 API 추가 |
| `hugo.toml` | 운영 API 주소와 30분 기준 설정 |
| `layouts/partials/view-counter.html` | 조회수를 표시할 공통 요소 생성 |
| 게시글·목록 템플릿 | 상세는 `visit`, 목록은 `read` 모드로 연결 |
| `assets/js/view-counter.js` | 집계 요청, 재시도, 목록 캐시 구현 |
| `layouts/_default/baseof.html` | JavaScript를 한 번 로드 |

템플릿 이름은 이 블로그 기준이다. 다른 Hugo 테마에서는 게시글의 메타데이터가 출력되는 위치, 목록 카드가 만들어지는 위치를 찾아 같은 방식으로 넣으면 된다.

예제는 `/posts/<slug>/` 경로를 사용하는 블로그에 맞춰져 있다. 저장소 이름이 경로 앞에 붙는 프로젝트 사이트라면 2편의 `normalizePostId()`도 그 구조에 맞게 바꿔야 한다.

## 2. 목록 조회 요청을 하나로 묶기

목록에 글이 10개 보인다고 API를 10번 호출할 필요는 없다. 필요한 글의 ID를 한 요청에 담으면 된다.

```text
GET /api/views/batch?postId=/posts/first/&postId=/posts/second/
```

응답은 게시글 경로를 키로 갖는 형태다.

```json
{
  "views": {
    "/posts/first/": 128,
    "/posts/second/": 42
  }
}
```

여기서 줄어드는 것은 **브라우저에서 Worker로 보내는 HTTP 요청 수**다. Worker는 글마다 분리된 Durable Object를 각각 읽는다. 일괄 조회가 모든 글을 하나의 저장소에서 읽는 방식으로 바꾸는 것은 아니다.

### API 경로와 허용 메서드 변경

`worker/src/index.ts`에서 2편의 다음 두 줄을 찾는다.

```ts
if (url.pathname !== "/api/views") return json({ error: "Not found" }, 404);
const methods = ["GET", "POST", "OPTIONS"];
```

이 두 줄을 아래 코드로 교체한다. 일괄 조회 경로는 POST를 허용하지 않는다.

```ts
const batch = url.pathname === "/api/views/batch";
if (!batch && url.pathname !== "/api/views") return json({ error: "Not found" }, 404);
const methods = batch ? ["GET", "OPTIONS"] : ["GET", "POST", "OPTIONS"];
```

### 일괄 조회 처리 추가

같은 파일에서 OPTIONS 처리 블록이 끝난 뒤, 기존 `const postId = normalizePostId(...)` 줄 바로 위에 아래 코드를 넣는다. 2편의 클래스와 나머지 GET·POST 처리는 유지한다.

```ts
if (batch) {
	const ids = url.searchParams.getAll("postId");
	if (ids.length === 0 || ids.length > 50 || ids.some(id => !normalizePostId(id))) {
		return json({ error: "Provide 1 to 50 valid postId parameters" }, 400);
	}
	try {
		const unique = [...new Set(ids.map(id => normalizePostId(id)!))];
		const values = new Map(await Promise.all(unique.map(async id =>
			[id, await env.MY_DURABLE_OBJECT.getByName(id).getViews()] as const,
		)));
		return json({ views: Object.fromEntries(ids.map(id => [id, values.get(normalizePostId(id)!)])) });
	} catch (error) {
		console.error("View counter batch request failed", error);
		return json({ error: "View counter temporarily unavailable" }, 503);
	}
}
```

먼저 모든 ID를 검사한 뒤 저장소를 읽는다. `/posts/first`와 `/posts/first/`처럼 같은 글로 정규화되는 ID는 한 번만 조회한다. 응답의 키는 브라우저가 보낸 원래 경로를 사용하므로 각 카드와 다시 연결하기 쉽다.

한 요청은 최대 50개 ID를 받는다. 이 숫자는 이 예제에서 정한 제한이다. 브라우저 코드도 50개 또는 약 7KB 길이의 URL을 기준으로 요청을 나눈다. 평소 목록은 한 번에 처리하고, 글이 많거나 경로가 길 때만 여러 번 호출한다.

## 3. Hugo에 조회수가 들어갈 자리 만들기

Hugo는 빌드할 때 HTML을 만든다. 실시간 조회수는 HTML이 열린 뒤 JavaScript가 가져와 채운다. 따라서 템플릿에는 숫자 대신 **API 주소, 게시글 경로, 동작 모드**를 넣는다.

### API 주소 설정

`hugo.toml`의 기존 `[params]` 아래에 추가한다. `[params]`를 중복 선언하지 않는다.

```toml
viewCounterEndpoint = "https://<worker-name>.<subdomain>.workers.dev/api/views"
viewCounterWindowMinutes = 30
```

주소는 뒤에서 `wrangler deploy`가 출력하는 실제 Worker 주소로 바꾼다. 마지막 `/api/views`까지 포함한다. 로컬에서는 아래 partial이 자동으로 `http://localhost:8787/api/views`를 사용한다.

### 공통 partial 작성

`layouts/partials/view-counter.html`을 만들고 아래 코드를 넣는다.

```go-html-template
{{ $page := .page }}
{{ $mode := .mode }}
{{ $endpoint := site.Params.viewCounterEndpoint }}
{{ if hugo.IsServer }}
  {{ $endpoint = "http://localhost:8787/api/views" }}
{{ end }}
{{ if $endpoint }}
  <span data-view-counter-separator hidden aria-hidden="true">·</span>
  <span data-view-counter
        data-mode="{{ $mode }}"
        data-endpoint="{{ $endpoint }}"
        data-post-id="{{ $page.RelPermalink }}"
        data-window-minutes="{{ site.Params.viewCounterWindowMinutes | default 30 }}"
        aria-live="polite" hidden></span>
{{ end }}
```

`data-*` 속성은 JavaScript에 전달할 값이다. `hidden`으로 시작하고 숫자를 정상적으로 받았을 때 표시한다. API가 실패했다고 실제 조회수를 0으로 보여주지는 않는다.

### 상세 화면과 목록에 연결

게시글 상세 템플릿에서는 날짜 등 메타데이터 옆에 다음 한 줄을 넣는다. 이 블로그에서는 `layouts/_default/single.html`의 posts 조건문 안에 해당한다.

```go-html-template
{{ partial "view-counter.html" (dict "page" . "mode" "visit") }}
```

목록 카드에는 다음 한 줄을 넣는다. 이 블로그에서는 `layouts/partials/post-card.html`의 날짜 옆이다.

```go-html-template
{{ partial "view-counter.html" (dict "page" . "mode" "read") }}
```

두 코드 모두 `.`이 해당 게시글 Page를 가리키는 위치에 넣어야 한다. 목록 템플릿의 반복문 바깥에 넣으면 목록 페이지 자체의 경로가 전달될 수 있다.

## 4. 브라우저에서 집계와 재시도 처리하기

`assets/js/view-counter.js`를 만든다. 이 절부터 6절까지의 **JavaScript 세 블록을 순서대로 같은 파일에 이어 붙인다.** 첫 블록에서 연 함수를 마지막 블록에서 닫기 때문에 중간 단계만으로는 실행되지 않는다.

먼저 상세 화면의 처리 순서부터 정한다.

1. 성공 여부를 확인하지 못한 `pendingId`가 있으면 같은 ID로 다시 요청한다.
2. 마지막 집계 성공 후 30분이 지나지 않았다면 GET만 보낸다.
3. 그 외에는 UUID를 만들고, 브라우저에 먼저 저장한 뒤 POST한다.
4. 유효한 성공 응답을 받으면 `pendingId`를 지우고 `lastCountedAt`을 기록한다.

**요청을 보낸 시점이 아니라 성공을 확인한 시점**을 저장하는 것이 핵심이다. 전송 전에 시간을 기록하면 실패한 요청도 30분 동안 집계된 것으로 취급하게 된다.

### 첫 번째 블록: 상세 화면의 방문 처리

```javascript
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
```

`post-view:v2:<postId>`에는 방문 상태만 저장한다. POST가 실패하면 `pendingId`를 남겨 다음 방문에도 같은 ID를 사용한다. 네트워크 오류나 5xx 응답에는 같은 ID로 한 번 더 시도한다. 4xx 응답은 즉시 재시도하지 않으므로 입력이나 설정을 확인해야 한다.

`navigator.locks`는 같은 출처의 여러 탭이 동시에 방문 상태를 확인하고 바꾸는 작업을 순서대로 처리하도록 한다. 이를 지원하지 않는 브라우저에서는 여러 탭이 동시에 새 ID를 만드는 경쟁 상황까지 완전히 막지는 못한다. [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)

localStorage에 상태를 저장할 수 없거나 UUID 생성에 실패하면 증가 요청 대신 GET으로 현재 값만 읽는다. 이 경우 일부 방문이 집계되지 않더라도, 재시도마다 새 요청을 만들어 중복 집계하는 일을 피하는 선택이다.

## 5. 목록에 표시할 숫자는 10분 동안 보관하기

방문 상태와 화면 표시용 캐시는 따로 저장한다.

| 저장 키 | 들어가는 값 | 사용 목적 |
| --- | --- | --- |
| `post-view:v2:<postId>` | `pendingId` 또는 `lastCountedAt` | 재시도와 30분 집계 판단 |
| `post-view-cache:v1:<endpoint>:<postId>` | `views`, `savedAt` | 목록 숫자를 10분 동안 재사용 |

목록을 열었다고 마지막 집계 시간이 바뀌면 안 된다. 또한 목록 캐시가 있다고 글을 실제로 읽은 방문을 건너뛰어도 안 된다. 그래서 서로 다른 키와 처리 함수를 사용한다.

캐시 키에는 API 주소도 포함한다. 같은 블로그 출처에서 API 주소를 바꾸더라도 이전 서버에서 받은 숫자를 새 서버의 값으로 재사용하지 않기 위해서다.

### 두 번째 블록: 캐시 읽기·저장·표시

앞의 코드 바로 아래에 이어 붙인다.

```javascript
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
```

`savedAt`은 숫자를 받아 저장한 시각이다. 10분이 지났거나 저장된 값이 손상되었으면 캐시를 사용하지 않는다. localStorage는 만료 시간을 자동으로 처리하지 않으므로 이 판단을 코드에서 한다. 만료된 항목을 타이머로 삭제하지는 않는다.

상세 화면에서 집계나 조회가 성공해도 `save()`를 호출한다. 따라서 글을 읽고 목록으로 이동했을 때 다음 목록 로딩은 상세 화면에서 받은 숫자를 사용할 수 있다. 브라우저의 뒤로 가기가 이전 화면을 그대로 복원하는 경우까지 즉시 갱신을 보장하는 것은 아니다.

## 6. 화면에 있는 글만 모아서 일괄 조회하기

사이트의 모든 게시글 조회수를 처음부터 가져오지는 않는다. **현재 HTML에 있는 카드 중 캐시가 없거나 만료된 글만** 묶는다.

예를 들어 카드 10개 중 7개에 유효한 캐시가 있다면 나머지 3개만 요청한다. 같은 글의 카드가 중복되어도 ID는 한 번만 보낸다. 모두 캐시가 있으면 API 요청은 없다.

### 세 번째 블록: 일괄 조회와 실행

앞의 두 블록 아래에 이어 붙여 파일을 완성한다.

```javascript
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
```

응답의 `views`에서 각 글의 숫자를 찾아 캐시에 저장하고 카드에 표시한다. 이 경로는 GET만 사용하며 방문 상태를 만들거나 미완료 POST를 재시도하지 않는다.

`startedAt` 비교는 오래 걸린 목록 응답이 더 최근에 저장된 상세 화면의 숫자를 덮어쓰는 일을 줄인다. 목록 응답을 기다리는 사이 다른 탭에서 같은 글을 읽었다면 더 최근 캐시를 우선한다.

### JavaScript를 한 번 로드하기

`layouts/_default/baseof.html`의 `</body>` 바로 앞에 다음 블록을 추가한다. 카드마다 스크립트를 넣으면 같은 요청이 여러 번 실행될 수 있으므로 공통 템플릿에서 한 번만 로드한다.

```go-html-template
{{ if or hugo.IsServer site.Params.viewCounterEndpoint }}
  {{ $counterScript := resources.Get "js/view-counter.js" | minify | fingerprint }}
  <script src="{{ $counterScript.RelPermalink }}" integrity="{{ $counterScript.Data.Integrity }}" defer></script>
{{ end }}
```

`defer`로 HTML을 해석한 뒤 실행하고, `fingerprint`로 파일 내용이 바뀌면 주소도 달라지게 한다. [Hugo fingerprint](https://gohugo.io/functions/resources/fingerprint/)

## 7. 로컬에서 API와 화면을 함께 확인하기

서버는 두 개를 실행한다. Hugo는 화면을, Wrangler는 조회수 API를 제공한다.

### 터미널 A: Worker 실행

`worker/` 디렉터리에서 실행한다. 블로그 Origin은 자신의 주소로 바꾼다.

```sh
npm run cf-typegen
npx tsc --noEmit
npm run dev -- --local \
  --var ALLOWED_ORIGINS:https://example.github.io,http://localhost:1313,http://127.0.0.1:1313
```

### 터미널 B: Hugo 실행

블로그 저장소 루트에서 실행한다.

```sh
hugo server
```

[로컬 블로그](http://localhost:1313/)에서 글 목록과 게시글 상세 화면을 열어 조회수 요청을 확인한다.

### 확인할 결과

브라우저 개발자 도구의 Network에서 `/api/views` 요청을 확인한다. 교차 출처 POST 앞에 보이는 OPTIONS는 브라우저의 사전 확인이며 추가 집계가 아니다.

| 동작 | 예상 결과 |
| --- | --- |
| 게시글 첫 방문 | POST, 성공하면 `조회수 n` 표시 |
| 같은 글을 30분 안에 새로고침 | GET, 추가 집계 없음 |
| 집계 성공 후 30분이 지나 다시 방문 | 새 ID의 POST |
| 응답을 받지 못한 뒤 재방문 | 이전 `pendingId`로 POST |
| 캐시 없는 목록 열기 | `/api/views/batch` GET |
| 같은 목록을 10분 안에 다시 로딩 | 유효한 캐시가 있는 글은 요청하지 않음 |
| API 서버를 끄고 캐시 없는 목록 열기 | 조회수는 숨기고 글 목록은 유지 |

시간 경계와 동시 요청은 수동 확인만으로 놓치기 쉽다. 이 예제의 검증에서는 브라우저 시간과 저장소를 대체한 테스트로 30분·10분 경계, 응답 유실 후 ID 재사용, 저장소 접근 실패를 확인한다. Worker는 별도 로컬 저장소에서 동시 요청과 재시작 후 보존을 검사한다. 실제 브라우저의 모든 동작을 자동 테스트가 대신하는 것은 아니다.

## 8. Cloudflare에 API 배포하기

로컬 확인이 끝났으면 `worker/wrangler.jsonc`의 `ALLOWED_ORIGINS`가 운영 블로그 Origin인지 확인한다. 로컬 테스트용 Origin은 앞의 실행 옵션으로만 추가했으므로 운영 설정에 옮길 필요가 없다.

`worker/`에서 로그인하고 배포한다. 이미 로그인되어 있다면 로그인 단계는 생략할 수 있다.

```sh
npx wrangler login
npm run deploy
```

브라우저에서 자신의 Cloudflare 계정으로 인증을 마친 뒤 `npm run deploy`를 실행하면 Worker 코드와 설정이 업로드된다. 배포 결과에 표시되는 `https://<worker-name>.<subdomain>.workers.dev`가 공개 API의 기본 주소다. 이 주소에 `/api/views`를 붙여 `hugo.toml`의 `viewCounterEndpoint`에 넣는다. [Wrangler 명령어](https://developers.cloudflare.com/workers/wrangler/commands/)

로컬 `.wrangler/`에 저장된 조회수는 운영으로 자동 복사되지 않는다. 새 운영 저장소는 별도로 시작한다. 이미 배포한 Worker를 갱신할 때는 기존 이름과 Durable Object 클래스, migration 이력을 유지한다.

### 조회 요청으로 운영 연결 확인

아래 URL은 실제 Worker 주소로, `Origin` 헤더는 자신의 블로그 Origin으로 바꿔 실행한다. GET은 조회수를 올리지 않는다.

```sh
curl -i \
  -H 'Origin: https://example.github.io' \
  'https://<worker-name>.<subdomain>.workers.dev/api/views?postId=/posts/counter-check/'
```

200 응답과 `{"views":0}` 같은 JSON, 자신의 블로그 Origin을 담은 `Access-Control-Allow-Origin` 헤더를 확인한다. 기존 데이터가 있으면 0이 아닌 값이 나올 수 있다.

### 회사 네트워크에서 인증서 오류가 난다면

이 작업 중에는 Wrangler 요청이 인증서 체인을 신뢰하지 못해 `fetch failed`로 끝나는 문제가 있었다. 회사 프록시의 인증서가 macOS에 신뢰 등록되어 있어도 Node.js가 그 저장소를 사용하지 않으면 발생할 수 있다.

Node.js 24.21.0 환경에서는 시스템의 신뢰 인증서를 사용하도록 다음처럼 실행했다.

```sh
NODE_USE_SYSTEM_CA=1 npx wrangler login
NODE_USE_SYSTEM_CA=1 npm run deploy
```

이 옵션은 인증서 검증을 끄는 것이 아니라 시스템 신뢰 저장소를 함께 사용하도록 한다. 회사 인증서 자체가 등록되지 않았다면 조직에서 안내하는 인증서를 먼저 설치해야 한다. 인증서의 호스트 이름 불일치나 VPN·네트워크 단절까지 이 옵션으로 해결되지는 않는다. [Node.js 시스템 CA 설정](https://nodejs.org/api/cli.html#node_use_system_ca1)

## 9. GitHub Pages에 화면 배포하기

Worker 배포만으로 Hugo의 HTML과 JavaScript가 바뀌지는 않는다. 블로그 변경 사항도 GitHub에 올리고 Pages 빌드가 끝나야 한다.

이 절은 GitHub Actions로 Hugo를 빌드하는 저장소를 기준으로 한다. 처음 구성한다면 저장소의 **Settings → Pages → Source**를 GitHub Actions로 설정하고 [Hugo의 GitHub Pages 배포 안내](https://gohugo.io/host-and-deploy/host-on-github-pages/)에 따라 workflow를 준비한다. 이 블로그의 workflow는 `main` push에 반응해 `hugo --gc --minify`로 빌드한 `public/`을 배포한다.

### 올릴 파일 확인

루트 `.gitignore`에 다음 항목이 있는지 확인한다. 기존 내용을 지우지 말고 필요한 항목을 추가한다.

```gitignore
/public/
/resources/_gen/
node_modules/
.wrangler/
.env*
!.env.example
.dev.vars*
!.dev.vars.example
*.log
*.pem
*.key
*.p12
*.pfx
```

Worker URL과 허용 Origin은 브라우저에도 보이는 공개 설정이다. 반면 API Token, 개인 키, 로컬 환경 파일은 커밋하면 안 된다. 이미 Git이 추적 중인 파일은 `.gitignore`에 추가해도 자동으로 제외되지 않는다. 이 경우 추적 상태를 별도로 정리하고, 비밀값이 노출되었다면 해당 자격증명을 폐기·재발급해야 한다.

### 저장소 루트에서 커밋하고 push

블로그 루트에서 먼저 빌드와 변경 목록을 확인한다.

```sh
hugo --gc --minify
git status --short
```

실제로 수정한 파일을 지정해 추가한다. 다른 테마를 사용한다면 아래 템플릿 경로를 자신이 수정한 파일로 바꾼다.

```sh
git add hugo.toml assets/js/view-counter.js \
  layouts/partials/view-counter.html layouts/partials/post-card.html \
  layouts/_default/single.html layouts/_default/baseof.html \
  worker/src/index.ts worker/wrangler.jsonc .gitignore

git diff --cached --stat
git diff --cached
```

화면 코드와 설정이 모두 포함되었는지, 토큰이나 로컬 파일이 섞이지 않았는지 확인한 뒤 커밋한다.

```sh
git commit -m "feat: add Cloudflare view counter to Hugo blog"
git push
```

배포 workflow가 감시하는 브랜치에 반영되어야 실제 배포가 시작된다. `git push` 성공은 업로드 성공이며 Pages 배포 완료와는 다르다. GitHub의 Actions에서 해당 커밋의 배포 작업이 성공했는지까지 확인한다.

작업 중에는 `worker/` 안에서 변경 사항을 추가해 Worker 파일만 커밋되고, Hugo 쪽 수정이 빠진 적이 있었다. 이 경우 Pages 작업이 성공해도 이전 화면이 그대로 나온다. **배포 성공 여부와 배포된 커밋에 원하는 파일이 들어 있는지는 별도로 확인해야 한다.**

## 10. 배포 후 어디부터 확인할까

문제가 생기면 API와 화면을 나누어 확인하면 원인을 좁히기 쉽다.

| 증상 | 먼저 확인할 곳 |
| --- | --- |
| Worker 주소에서 404 | 주소 끝의 `/api/views`, 배포한 Worker와 코드 버전 |
| 목록만 조회수가 안 나옴 | `/api/views/batch`가 포함된 Worker를 배포했는지 |
| 브라우저에서 CORS 오류 | 실제 블로그 Origin과 `ALLOWED_ORIGINS`의 일치 여부 |
| 운영 화면이 localhost API에 요청 | 운영 빌드에 들어간 endpoint와 HTML |
| Pages 배포 성공인데 이전 화면 | 배포 커밋에 Hugo 템플릿·JavaScript 변경이 포함됐는지 |
| 목록 숫자가 잠시 이전 값 | 10분 표시 캐시가 유효한지 |

마지막으로 실제 블로그에서 게시글 하나를 열고, Network에 운영 Worker로 보내는 요청이 있는지 확인한다. 정상 응답 이후 `조회수 n`이 보이고, 목록에서는 증가 요청 없이 숫자를 가져오면 연결된 것이다.

이 구현의 조회수는 엄밀한 순방문자 수가 아니다. 브라우저 저장소를 지우거나 다른 기기를 쓰면 같은 사람도 다시 집계될 수 있고, 새 UUID를 계속 보내는 프로그램을 막지도 않는다. 30분 기준은 서버의 사용자 인증이나 봇 방어가 아니라 **같은 브라우저의 반복 방문을 줄이는 정책**이다.

개인 블로그에서는 이 정도의 기준으로 시작하되, 숫자의 의미는 분명히 해두는 편이 좋다. 화면 표시용 캐시, 방문 집계 정책, 서버의 재시도 중복 방지는 각각 다른 역할을 맡는다.

이 구조를 활용하면 같은 방식으로 좋아요 기능도 구현할 수 있다. 게시글별 Durable Object에 브라우저별 좋아요 상태를 저장하고, 버튼을 누르면 좋아요를 추가하거나 취소하도록 연결하면 된다.
