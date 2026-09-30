# 게시글 조회수 API

Hugo/GitHub Pages → Worker `/api/views` → 게시글별 SQLite-backed Durable Object.

## 파일과 책임

- `src/index.ts`: HTTP API·CORS·입력 검증 및 `MyDurableObject` 구현.
- `wrangler.jsonc`: `MY_DURABLE_OBJECT` 바인딩, SQLite `v1` migration, 프로덕션 Origin.
- `worker-configuration.d.ts`: `npm run cf-typegen`으로 생성하는 타입.
- `test/api.test.mjs`: 실제 로컬 Workers runtime 테스트와 장애 응답 검증.
- `test/frontend.test.mjs`: 클라이언트 렌더링·30분·여러 탭·실패 처리 테스트.
- `../hugo.toml`: 공개 API endpoint 및 중복 제한 시간.
- `../layouts/partials/view-counter.html`: 공통 메타데이터 표시와 스크립트 연결.
- `../assets/js/view-counter.js`: 방문 시각 저장, GET/POST 선택, 조회수 표시.

개발 지침은 [develop-cloudflare-worker](../.agents/skills/develop-cloudflare-worker/SKILL.md)에 있다.

## 저장과 API

`hugo.toml`의 `/posts/:slug/` 규칙으로 생성되는 `.RelPermalink`를 postId로 사용한다. 제목이나 slug를 클라이언트에서 다시 계산하지 않는다. `/posts/spark-cache-when-to-use/`처럼 현재 실제 경로를 전달한다. URL/slug를 변경하면 새 카운터가 되므로 기존 집계를 이어야 한다면 별도 이전이 필요하다.

Worker가 postId를 검증·정규화하고 `MY_DURABLE_OBJECT.getByName(postId)`로 같은 글의 요청을 같은 Object에 보낸다. 각 Object의 독립적인 SQLite DB 안 `counter` 테이블의 `id=1` 행에 조회수가 저장된다. 요청 ID 기록과 조회수 UPSERT를 같은 SQLite transactionSync로 처리한다. 기존 counter 테이블은 유지하고 counted_requests 테이블을 추가한다. 같은 ID의 재요청은 증가 없이 현재 값을 반환한다. 요청 ID는 영속 보관하며 자동 삭제하지 않으므로 집계 방문당 한 행씩 증가한다. 프로세스 메모리가 아닌 영속 저장이며 외부 DB나 D1은 사용하지 않는다.

| 요청 | 결과 |
| --- | --- |
| `GET /api/views?postId=/posts/example/` | 현재 값만 반환, 미집계 글은 `{"views":0}` |
| `POST /api/views?postId=/posts/example/` + `Idempotency-Key: <UUID v4>` | 새 요청 ID만 1 증가, 같은 ID 재시도는 증가 없이 현재 값 반환 |
| `OPTIONS /api/views` | 허용 Origin의 GET/POST preflight에 204 |
| 누락·잘못된·중복 postId | 400 JSON |
| 허용하지 않은 Origin | 403 JSON, 허용 CORS 헤더 없음 |
| 없는 endpoint | 404 JSON |
| 지원하지 않는 method | 405 JSON 및 Allow 헤더 |
| 저장소/RPC 실패 | 503 JSON, 내부 오류 내용은 서버 로그에만 기록 |

postId는 최대 1024자, `/posts/` 아래 한 slug만 허용한다. slug에는 문자·결합 문자·숫자·하이픈·밑줄을 허용한다. URL 인코딩된 한글과 마지막 slash 유무는 같은 ID로 정규화한다. 전체 URL, query/hash, 하위 경로, 잘못된 인코딩은 거절한다. 실제 게시물 존재 여부까지 검사하는 API는 아니므로 유효한 형식의 새 ID는 독립 카운터를 만들 수 있다.

응답은 `Cache-Control: no-store`, `Vary: Origin`을 사용한다. 프로덕션은 `https://thedduro.github.io`만 허용한다. Origin 없는 curl 같은 클라이언트도 호출할 수 있다. CORS·localStorage는 인증이나 악의적인 집계 조작 방지 장치가 아니며 정확한 Unique Visitor를 측정하지 않는다.

## 30분 중복 방지

브라우저 localStorage의 `post-view:v2:<postId>`에 `{lastCountedAt}` 또는 `{pendingId}`를 저장한다. 기본 제한은 `hugo.toml`의 `viewCounterWindowMinutes = 30`이다. 최초 방문·마지막 성공 확인 후 30분 경과 시 POST, 그 안의 재방문은 GET한다. GET은 제한 시간을 연장하지 않는다.

POST 전 UUID v4 요청 ID를 pendingId로 저장하고 `Idempotency-Key` 헤더로 전송한다. 통신 실패·5xx에서는 같은 ID로 한 번 재시도하며, 계속 실패하면 기록을 유지해 다음 방문 때 재사용한다. 유효한 성공 응답을 받은 뒤에만 lastCountedAt을 현재 시각으로 기록하고 pendingId를 함께 지운다. 서버는 이미 집계한 ID를 영속 기록하므로 응답 유실이나 성공 시각 저장 실패 후 재전송도 중복 집계하지 않는다. 재시도 응답은 최초 값이 아닌 현재 조회수를 반환한다.

기존 v1 시각은 성공 여부를 알 수 없는 시도 기록이므로 승계하지 않는다. 전환 후 첫 방문은 새 정책으로 집계할 수 있다. 저장소 사용이 불가능하면 GET만 한다. Web Locks 지원 브라우저에서는 같은 Origin의 탭을 직렬화한다. 미지원 환경에서 동시에 새 ID를 만든 탭, 다른 브라우저·기기·Origin, 저장소 삭제까지 방문자 단위로 중복 제거하지는 않는다. 서버의 요청 ID 검증은 30분 방문 제한을 강제하는 인증 장치가 아니다.

정상 응답만 `조회수 128` 형태로 보여준다. 장애·잘못된 응답에서는 조회수와 그 앞 구분자를 숨기고 본문은 정상 표시한다. 초안에는 연결하지 않으며 endpoint가 비어 있으면 프로덕션에서 조회수 기능을 비활성화한다.

## 로컬 실행과 검증

Node.js와 Hugo가 설치된 환경에서 실행한다. 이 작업은 Node 24.21.0, Wrangler 4.136.1, Hugo 0.164.0으로 검증했다.

저장소 루트에서:

```sh
cd worker
npm ci
npm run cf-typegen
npm run typecheck
npm test
npm run dev
```

별도 터미널에서 저장소 루트 기준:

```sh
hugo server -D
```

`http://localhost:1313/posts/spark-cache-when-to-use/`를 연다. Hugo server는 로컬 Worker `http://localhost:8787/api/views`를 사용한다. `npm run dev`에서만 localhost 및 127.0.0.1의 1313 Origin을 추가한다. 다른 포트를 사용하면 로컬 실행의 허용 Origin도 맞춰야 한다. 프로덕션 vars에 localhost를 추가할 필요는 없다.

```sh
curl -X POST -H 'Idempotency-Key: 11111111-1111-4111-8111-111111111111' \
  'http://localhost:8787/api/views?postId=/posts/local-check/'
curl 'http://localhost:8787/api/views?postId=/posts/local-check/'
curl -X POST -H 'Idempotency-Key: 22222222-2222-4222-8222-222222222222' \
  'http://localhost:8787/api/views?postId=/posts/local-check/'
```

새 ID에서는 순서대로 1, 1, 2가 반환된다. 브라우저 개발자 도구의 Network에서 최초 POST, 새로고침 GET과 화면 숫자를 확인한다. 30분 이후를 시험하려면 Application/Storage에서 해당 `post-view:v2:...` JSON의 `lastCountedAt`을 30분 이전의 밀리초 시각으로 바꾼다. 같은 Idempotency-Key로 POST를 반복하면 값이 증가하지 않는지도 확인한다.

`npm test`는 임시 디렉터리와 빈 포트에서 로컬 Worker를 시작하고 종료한다. 50개 동시 증가, 재시작 후 저장 보존, API 오류/CORS, 프론트엔드 정책을 검증한다. 테스트 데이터는 일반 개발 저장소와 분리해서 정리한다. `npm run dev` 데이터는 기본 `worker/.wrangler/state/`에 남으며 Cloudflare 프로덕션 데이터와 별개다.

## 실제 배포: 사용자가 실행할 단계

이 절의 명령은 계정 로그인과 실제 Cloudflare 리소스 생성/업데이트를 수행한다. 로컬 검증에는 필요 없다.

1. `worker/wrangler.jsonc`의 Worker 이름 `worker`가 대상 계정의 기존 서비스와 충돌하지 않는지 확인한다. 첫 배포 전에 필요하면 고유한 이름으로 바꾼다. 기존 서비스를 덮어쓰지 않는다.
2. `worker/`에서 로그인하고 대상 계정을 확인한다.

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

   여러 계정이 있다면 Wrangler 설정의 `account_id`를 의도한 계정으로 지정한다. API Token을 코드나 프론트엔드에 넣지 않는다.
3. 검증 후 배포한다. 첫 배포에서 `v1` migration으로 SQLite-backed Durable Object namespace가 생성된다.

   ```sh
   npm run typecheck
   npm test
   npm run deploy
   ```

4. 출력된 실제 Worker URL을 사용해 GET을 확인한다. 예시의 `<배포된-Worker-호스트>`는 그대로 사용하지 않는다.

   ```sh
   curl -H 'Origin: https://thedduro.github.io' \
     'https://<배포된-Worker-호스트>/api/views?postId=/posts/spark-cache-when-to-use/'
   ```

5. 루트 `hugo.toml`의 기존 `[params]`에서 한 항목을 설정한다.

   ```toml
   viewCounterEndpoint = 'https://<배포된-Worker-호스트>/api/views'
   ```

6. Hugo 빌드로 확인하고, 사용자의 기존 GitHub Pages 배포 절차로 사이트를 갱신한다. Pages workflow는 수정할 필요가 없다. 공개 게시글을 열어 허용 Origin과 조회수 표시를 확인한다.

Worker 배포만으로 GitHub Pages의 설정이 바뀌지는 않는다. Worker URL을 넣은 Hugo 사이트도 배포해야 한다. 기존 DO class/binding 이름과 migration 이력은 이후 배포에서 유지한다. `.dev.vars*`, `.env*`, `.wrangler/`, `node_modules/`는 Git에서 제외한다.

API 변경 배포 순서: Worker를 먼저 재배포하고, 그 다음 Hugo 사이트를 배포한다. 새 프론트엔드를 기존 Worker에 먼저 연결하면 기존 Worker가 요청 ID를 무시해 재시도가 중복 집계될 수 있다. 새 Worker는 ID 없는 POST를 400으로 거절한다. Durable Object class/binding 및 v1 migration은 변경하지 않는다.

## 글 목록 조회수 캐시

공통 post-card에 날짜와 조회수를 표시한다. 홈·글 목록·태그 목록은 방문 기록을 변경하거나 조회수를 증가시키지 않는다. 현재 페이지에 렌더링된 글 중 캐시가 없거나 만료된 ID만 모아 `GET /api/views/batch?postId=...&postId=...`로 한 번에 조회한다. 응답은 `{ "views": { "/posts/example/": 128, "/posts/other/": 53 } }` 형식이다. 서버는 각 ID를 검증하고 정규화한 ID별 Durable Object를 조회한다. 브라우저 요청 수를 줄이는 것이며 내부 Object 조회 수는 글 수에 비례한다.

일괄 API는 GET/OPTIONS만 허용하고 1~50개 ID를 받는다. 목록이 50개를 넘거나 URL이 약 7 KB를 넘으면 클라이언트가 여러 묶음으로 나누어 순차 요청한다. 동일한 글 카드가 반복돼도 ID는 한 번만 전송한다. 잘못된 ID가 하나라도 있으면 400, 저장소 조회 실패는 503이며 목록은 숫자를 꾸며 표시하지 않는다.

성공한 조회수는 localStorage의 `post-view-cache:v1:<endpoint>:<postId>`에 `{views, savedAt}`으로 저장한다. 목록은 10분 미만 캐시를 사용하고 만료·손상·접근 실패 시 일괄 GET한다. 페이지를 열 때 만료 여부를 검사하며 주기적인 자동 갱신은 하지 않는다. 다른 방문자의 증가분은 목록을 불러올 때 최대 약 10분 이전 값으로 보일 수 있다. 글 상세는 캐시 유무와 무관하게 기존 방문 집계/조회를 수행하고 성공 결과로 캐시를 갱신한다. 늦게 도착한 목록 응답이 요청 시작 이후 저장된 상세 결과를 덮어쓰지 않도록 한다. 30분 방문 제한과 10분 표시 캐시는 별개다.

초안 및 API 실패 시 유효한 캐시가 없는 카운터는 숨긴다. 스크립트는 baseof에서 페이지당 한 번만 로드한다. 일괄 API를 추가한 Worker를 먼저 재배포한 다음 블로그를 배포한다.

## 좋아요

게시글 하단의 좋아요 버튼은 같은 Worker의 `/api/likes`를 사용한다. API 주소는 기존 `viewCounterEndpoint`의 `/api/views`를 `/api/likes`로 바꿔 얻는다. 기존 글별 Object에 `post_likes` 테이블을 추가하며 조회수, class/binding, v1 migration은 유지한다. 테이블은 Object 생성자에서 `CREATE TABLE IF NOT EXISTS`로 준비하므로 별도 namespace migration은 필요 없다.

- `GET /api/likes?postId=/posts/example/&visitorId=<UUID v4>` → `{ "likes": 3, "liked": true, "revision": 1 }`. visitorId를 생략하면 합계만 조회하고 개인 상태는 false/0이다.
- 동일 URL로 `POST`하고 JSON `{ "liked": false, "revision": 1 }`을 보내면 좋아요를 취소한다. visitorId는 필수다. revision이 현재 저장값과 다르면 최신 상태와 HTTP 409를 반환하고 변경하지 않는다.
- 방문자 상태와 revision 변경은 하나의 `transactionSync`에서 처리한다. 취소 기록도 남겨 이전 요청의 재전송이 다시 좋아요를 누르는 일을 막는다. 합계는 저장된 liked 값의 합이다.
- 브라우저는 `post-like-visitor:v1:<API origin>`에 무작위 UUID를 저장하고, 변경 직전 서버 상태를 읽는다. Web Locks를 지원하면 같은 브라우저의 탭 사이 요청도 직렬화한다. 실패 후 버튼을 누르면 먼저 조회만 수행해 불확실한 결과를 확인한다. 저장소를 사용할 수 없으면 합계만 표시한다.
- 로그인 기반 사용자 식별은 아니다. 저장소 삭제, 시크릿 모드, 다른 기기에서는 별도 방문자로 집계된다. 공개 API이므로 임의 UUID를 통한 조작 방지는 제공하지 않는다.

배포할 때는 `worker/`에서 `npm run deploy`로 Worker를 먼저 갱신한 뒤 기존 GitHub Pages 절차로 블로그를 배포한다. 이전 Worker에는 좋아요 API가 없으므로 프론트엔드만 배포하면 버튼에 조회 실패 안내가 표시된다. 로컬 검증은 `npm run typecheck`, `npm test`, 저장소 루트의 `hugo`로 수행한다.
