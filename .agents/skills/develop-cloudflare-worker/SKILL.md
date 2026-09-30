---
name: develop-cloudflare-worker
description: 이 저장소의 TypeScript Cloudflare Worker와 Durable Objects API를 구현·수정·검증하고 Hugo 프론트엔드에 연결한다. worker/ 코드, Wrangler 바인딩·스토리지, CORS 및 조회수 연동 작업에 사용한다.
---

# Cloudflare Worker 개발

## 작업 진입

- `worker/src/`, `worker/wrangler.jsonc`, `worker/package.json`과 기존 변경을 먼저 확인한다. Hugo 연동 시 `hugo.toml`, 공통 게시글 layout, 관련 partial과 JavaScript까지 확인한다.
- 기억이나 생성된 안내문을 최신 사양으로 간주하지 않는다. 변경에 관련된 공식 API 문서와 설치된 Wrangler 버전을 대조한다. 한도·요금이 필요할 때만 해당 제품의 공식 limits·pricing을 확인한다.
- 게시물 작성 skill과 개발 지침을 섞지 않는다. 글·SEO 메타데이터·Pages 배포 workflow는 요청에 필요한 범위에서만 변경한다.

## 현재 구조와 저장 규칙

- `src/index.ts`의 Worker가 HTTP 계약·입력 검증·CORS를 처리하고 `MyDurableObject`가 영속 상태를 관리한다. `cloudflare:workers`의 `DurableObject<Env>`를 상속하고 namespace RPC로 호출한다.
- 생성된 `MY_DURABLE_OBJECT` 바인딩, `MyDurableObject` 클래스, `v1`의 `new_sqlite_classes`를 활용한다. 배포된 namespace의 클래스명·마이그레이션 이력을 임의로 바꾸지 않는다. 새 변경에는 필요한 migration을 추가한다.
- 새 namespace는 SQLite backend를 우선한다. 메모리 필드만으로 영속성을 보장하지 않는다. 외부 DB나 Workers KV를 조회수 저장을 위해 추가하지 않는다.
- 논리적 개체마다 안정적인 이름으로 `getByName()`을 호출한다. 현재 조회수는 정규화한 `/posts/<slug>/`당 Object 하나이고, 각 Object의 SQLite `counter` 테이블에 저장한다.
- 조회수는 요청 ID 기록과 `UPSERT ... RETURNING`을 하나의 `transactionSync`로 처리해 중복 요청을 제거한다. 요청 ID는 영속 보관하고 임의 TTL을 추가해 오래된 재시도를 다시 집계하지 않는다. 읽기와 쓰기 사이에 외부 I/O를 끼우지 않는다. 여러 SQL 작업의 원자성이 필요하면 동기 `transactionSync`를 고려한다. 비동기 초기화가 필요할 때만 `blockConcurrencyWhile`을 사용한다.
- SQL에 입력값을 문자열 보간하지 않는다. 매개변수 바인딩을 사용한다. 현재 고정 counter 쿼리는 외부 입력을 포함하지 않는다.

## HTTP와 블로그 연결

- 조회 GET과 증가 POST를 분리한다. 잘못된 입력 400, 금지 Origin 403, 미등록 경로 404, 지원하지 않는 method 405, 저장소 장애 503을 JSON으로 반환한다. 오류 응답에도 허용 Origin의 CORS 헤더를 유지한다.
- `postId`는 URL 전체가 아닌 게시글 pathname이다. 길이·구조·중복 query parameter를 검사하고 URL 인코딩과 마지막 slash를 정규화한다. 현재 형식 검증은 실제 게시물 존재 검증이 아니다.
- 프로덕션 Origin은 `ALLOWED_ORIGINS`에서 명시적으로 허용한다. OPTIONS와 simple POST 모두 검사한다. 로컬 Origin은 로컬 실행 명령에서만 추가한다. CORS는 인증이나 봇 방지가 아니며 Origin 없는 공개 API 호출을 막지 못한다.
- API URL은 `hugo.toml`의 `params.viewCounterEndpoint` 한 곳에서 관리한다. Hugo server에서는 partial이 로컬 API를 선택한다. 공통 layout과 assets를 사용하고 글마다 코드를 넣지 않는다.
- pathname은 `.RelPermalink`를 사용해 실제 공개 경로와 일치시킨다. 제목으로 ID를 따로 계산하지 않는다. slug/URL 변경은 별도 Object를 만들므로 기존 조회수를 이어야 할 때는 이전 계획이 필요하다.
- 클라이언트는 마지막 성공 확인 시각부터 기본 30분 POST를 제한한다. pending UUID를 먼저 저장하고 Idempotency-Key로 전송한다. 실패 시 같은 ID로만 재시도하며 성공한 경우에만 시각을 기록한다. 저장소 접근 실패 시 GET만 사용한다. Worker를 먼저 배포한 뒤 프론트엔드를 배포한다. 서로 다른 탭·브라우저의 별도 ID까지 방문자 단위로 중복 제거하는 방식은 아니다.
- 목록은 GET만 수행하며 방문 기록과 pending ID를 변경하지 않는다. 목록은 캐시가 만료된 ID를 `/api/views/batch` GET으로 묶어 요청한다(최대 50개, 긴 URL 분할). 조회수 표시 캐시는 endpoint+postId별 10분이고 30분 집계 제한과 분리한다. 상세 페이지는 캐시로 방문 집계를 건너뛰지 않으며 성공 응답으로 캐시를 갱신한다. 공통 스크립트는 페이지당 한 번만 로드한다.
- 토큰을 프론트엔드에 넣지 않는다. `.dev.vars*`, `.env*`, `.wrangler/`가 ignore되는지 확인하고 생성 타입에 비밀값이 들어가지 않게 한다.

## 검증과 운영

- `worker/`에서 `npm ci`, `npm run cf-typegen`, `npm run typecheck`, `npm test`를 사용한다. 바인딩·vars 변경 뒤 타입은 직접 고치지 말고 재생성한다.
- `npm run dev`는 로컬 Worker와 로컬 스토리지를 사용한다. 원격 바인딩이나 `--remote`로 전환하지 않는다. 로컬 데이터와 프로덕션 데이터는 별개다.
- 실제 로컬 runtime에서 GET/POST, 서로 다른 ID, 동시 증가, 재시작 후 보존, validation·method·CORS를 확인한다. Hugo 연동은 빌드 및 실제 브라우저의 표시·새로고침·실패 상태를 확인한다.
- 진단에는 Wrangler 로그와 로컬 상태를 먼저 활용한다. Local Explorer가 필요한 경우 설치 버전이 제공하는 주소와 공식 문서를 확인한다. 관련 없는 KV/D1/R2/Workflows endpoint 목록을 고정해서 유지하지 않는다.
- 사용자 승인 범위에 없는 로그인·계정 연결·프로덕션 배포는 실행하지 않고 명령과 영향을 설명한다. 프로젝트별 실행·배포 절차는 `worker/README.md`를 참고한다.

## 공식 근거

2026-09-28에 현재 코드와 대조했다. 이후 변경 시 관련 절을 다시 확인한다.

- [SQLite-backed storage와 신규 namespace 권장 방식](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
- [SQL API와 transactionSync](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Object 경계와 안정적인 이름으로 라우팅](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Wrangler 설정](https://developers.cloudflare.com/workers/wrangler/configuration/) 및 [명령](https://developers.cloudflare.com/workers/wrangler/commands/)

## 좋아요 확장

- 좋아요는 `/api/likes`와 기존 글별 Object의 `post_likes` 테이블을 사용한다. 브라우저 UUID별 liked 상태와 revision을 영속 보관하고 취소 시에도 revision 기록을 삭제하지 않는다.
- POST는 원하는 liked 값과 읽어 온 revision을 전달한다. transactionSync 안에서 revision을 비교하고 상태를 변경한다. 충돌 시 HTTP 409와 현재 상태를 반환해 지연된 요청이 최신 상태를 덮어쓰지 않게 한다.
- 프론트엔드는 변경 직전 조회하고 가능한 경우 Web Locks로 탭 간 요청을 직렬화한다. 응답 유실 후에는 조회로 상태를 먼저 복구한다. localStorage가 불가능하면 읽기만 허용한다. UUID는 로그인 인증이나 사람 단위 중복 방지를 제공하지 않는다.
