---
title: "Cloudflare로 GitHub Pages 블로그에 조회수 붙이기 - 2편"
date: 2026-09-28T14:17:45+09:00
draft: false
description: "SQLite-backed Durable Object에 게시글별 조회수를 저장하고, 중복 집계 방지를 TypeScript로 구현한다."
categories: ["Cloud"]
tags: ["Cloud", "Cloudflare", "Durable Objects", "TypeScript", "SQLite"]
slug: "cloudflare-blog-view-counter-2"
series: "Cloudflare로 블로그에 조회수 붙이기"
seriesOrder: 2
---

[1편](/posts/cloudflare-blog-view-counter-1/)에서는 Worker와 Durable Object가 포함된 프로젝트를 만들었다. 로컬 서버에 접속하면 `Hello, world!`라는 문구가 나왔지만, 아직 조회수를 저장하는 기능은 없다.

이번 편에서는 그 기본 코드를 수정해 **게시글별 조회수를 저장하고, 요청하면 현재 값을 돌려주는 API**를 만든다.

조회수를 저장할 때는 두 상황을 고려해야 한다.

- 여러 방문자의 요청이 동시에 들어와도 빠짐없이 더해져야 한다.
- 서버가 조회수를 올린 뒤 응답이 끊겨도, 같은 요청을 다시 보냈다는 이유로 두 번 집계하면 안 된다.

첫 번째는 SQLite에서 값을 증가시키는 방식으로, 두 번째는 처리한 요청 ID를 함께 저장하는 방식으로 해결한다.

작업할 파일은 1편에서 만든 `worker/` 안의 두 개다.

| 파일 | 이번 편에서 할 일 |
| --- | --- |
| `wrangler.jsonc` | Worker와 Durable Object를 연결하고 허용할 블로그 주소 설정 |
| `src/index.ts` | 저장소, 게시글 ID 검사, HTTP 요청 처리 구현 |

`src/index.ts` 코드는 설명을 따라 세 부분으로 나누어 작성한다. 목록 일괄 조회와 브라우저 연동은 3편에서 다룬다. 예제는 Node.js 24.21.0과 Wrangler 4.136.1에서 검증했다.

## 1. 게시글과 방문 요청을 구분하기

먼저 **어느 글의 조회수인지** 구분할 값이 필요하다. 이를 `postId`라고 부르고, `/posts/spark-cache/`처럼 게시글 URL의 경로 부분을 사용한다. 도메인과 `?` 뒤의 쿼리 문자열은 제외한다.

서버가 임의로 제목을 조합해 ID를 만들기보다 실제 게시글 경로를 전달하는 편이 화면과 저장소를 맞추기 쉽다. 다만 URL을 변경하면 다른 Object로 연결된다. 기존 조회수를 이어갈 필요가 있다면 URL을 유지하거나 별도 이전을 해야 한다.

`postId`와 별개로 증가 요청마다 `requestId`를 하나 만든다. 두 값의 수명과 용도가 다르다.

| 값 | 구분하려는 대상 | 재시도할 때 |
| --- | --- | --- |
| `postId` | 어느 게시글인가 | 같은 글의 ID 유지 |
| `requestId` | 어느 한 번의 집계 요청인가 | 반드시 같은 요청 ID 유지 |

예를 들어 다음과 같은 상황이다.

1. 브라우저가 글 A의 조회수를 올려 달라는 요청을 `request-1`이라는 ID와 함께 보낸다.
2. 서버는 조회수를 128에서 129로 올리고, 처리한 ID를 저장한다.
3. 응답이 도착하기 전에 연결이 끊겨 브라우저가 같은 요청을 다시 보낸다.

이때 **같은 ID를 보내면** 서버는 이미 처리한 요청으로 판단한다. 새 ID를 보내면 별개의 방문으로 집계한다. 실제 코드에서는 `request-1` 대신 UUID v4 형식의 ID를 사용한다.

API는 다음처럼 분리한다.

| 요청 | 동작 |
| --- | --- |
| `GET /api/views?postId=/posts/spark-cache/` | 증가 없이 현재 조회수 반환 |
| `POST /api/views?postId=/posts/spark-cache/` | `Idempotency-Key` 헤더의 요청 ID가 처음이면 1 증가 |
| 같은 ID의 POST 재전송 | 증가 없이 현재 조회수 반환 |

여기서 멱등성은 **같은 ID를 반복해 보내도 증가 효과가 한 번만 생긴다**는 뜻이다. 재시도 응답의 숫자까지 처음과 같을 필요는 없다. 그 사이 다른 방문자가 읽었다면 현재 조회수는 더 커져 있을 수 있다.

## 2. Worker와 Object 연결 설정하기

`worker/wrangler.jsonc`를 연다. 1편에서 생성하고 아직 배포하지 않은 프로젝트라면 다음 설정을 적용한다.

`https://example.github.io`는 자신의 블로그 **Origin(프로토콜·호스트·포트로 구분하는 출처)**  으로 바꾼다. 이 예에서는 `https://<사용자명>.github.io`이며, 경로나 마지막 `/`는 붙이지 않는다. 블로그 주소에 저장소 이름이 포함되어 있어도 이 값에는 넣지 않는다.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-21",
  "vars": {
    "ALLOWED_ORIGINS": "https://example.github.io"
  },
  "durable_objects": {
    "bindings": [
      {
        "name": "MY_DURABLE_OBJECT",
        "class_name": "MyDurableObject"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["MyDurableObject"]
    }
  ]
}
```

이미 배포한 프로젝트에서는 이 파일을 통째로 덮어쓰지 않는다. 기존 Worker 이름, compatibility date, 클래스 이름과 migration 이력을 유지하고 필요한 설정만 반영한다. 위 날짜는 이 예제의 기준값이며, 새로 생성된 프로젝트의 날짜를 맞추기 위해 과거로 되돌릴 필요는 없다.

설정에서 헷갈리기 쉬운 부분은 두 곳에 등장하는 `name`이다.

| 설정 | 역할 |
| --- | --- |
| 최상위 `name` | 배포할 Worker 이름: `worker` |
| `main` | 실행할 코드 파일: `src/index.ts` |
| `compatibility_date` | 런타임의 호환 동작을 선택하는 기준 날짜 |
| `bindings` 안의 `name` | 코드에서 Object에 접근할 이름: `env.MY_DURABLE_OBJECT` |
| `class_name` | `src/index.ts`에서 내보낼 클래스 이름: `MyDurableObject` |

즉, `MY_DURABLE_OBJECT`라는 바인딩을 통해 `MyDurableObject` 클래스의 Object에 접근하도록 연결하는 설정이다.

`new_sqlite_classes`는 해당 클래스를 SQLite 저장소를 사용하는 Durable Object로 등록하는 migration 설정이다. 이는 `counter` 같은 SQL 테이블을 만드는 명령과는 다르다. 테이블은 다음 단계의 코드에서 생성한다. 생성된 `v1` 항목이 이미 있다면 동일한 migration을 한 번 더 추가하지 않는다. [SQLite-backed Durable Object 설정](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/#create-sqlite-backed-durable-object-class)

`ALLOWED_ORIGINS`에는 허용할 프론트엔드 출처를 넣는다. 공개 가능한 설정값이므로 일반 `vars`에 둔다. API Token이나 비밀번호를 여기에 넣는 것은 별개의 문제이며, 이 조회수 API에는 그런 인증정보가 필요하지 않다.

## 3. SQLite에 조회수와 처리 기록 저장하기

`worker/src/index.ts`에 자동 생성된 코드를 아래 코드로 교체한다. 이 부분은 조회수와 처리한 요청 ID를 저장하는 클래스다.

**3절의 클래스 → 4절의 함수 → 5절의 요청 핸들러**를 같은 파일에 순서대로 넣으면 전체 구현이 완성된다.

```ts
import { DurableObject } from "cloudflare:workers";

// Keep the generated class/binding names and v1 SQLite migration stable.
export class MyDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS counter (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			views INTEGER NOT NULL CHECK (views >= 0)
		)`);
		ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS counted_requests (
			request_id TEXT PRIMARY KEY
		)`);
	}

	getViews(): number {
		return this.ctx.storage.sql.exec<{ views: number }>(
			"SELECT views FROM counter WHERE id = 1",
		).toArray()[0]?.views ?? 0;
	}

	incrementViews(requestId: string): number {
		// Persist the receipt and increment together: neither can commit alone.
		return this.ctx.storage.transactionSync(() => {
			const inserted = this.ctx.storage.sql.exec<{ request_id: string }>(
				"INSERT INTO counted_requests (request_id) VALUES (?) ON CONFLICT DO NOTHING RETURNING request_id",
				requestId,
			).toArray();
			if (inserted.length === 0) return this.getViews();
			return this.ctx.storage.sql.exec<{ views: number }>(`
				INSERT INTO counter (id, views) VALUES (1, 1)
				ON CONFLICT (id) DO UPDATE SET views = views + 1
				RETURNING views
			`).one().views;
		});
	}

}
```

### 두 테이블의 역할

| 테이블 | 저장할 값 | 용도 |
| --- | --- | --- |
| `counter` | 현재 조회수 한 개 | 화면에 보여줄 숫자 |
| `counted_requests` | 이미 집계한 요청 ID들 | 재전송된 요청인지 확인 |

`counter`에 `postId` 컬럼이 없는 이유는 **게시글마다 별도의 Object와 SQLite 저장소를 사용하기 때문**이다. Spark 글과 Airflow 글이 각각 `id = 1`인 행을 가져도 서로 다른 저장소에 있으므로 섞이지 않는다.

생성자의 `CREATE TABLE IF NOT EXISTS`는 테이블이 없을 때만 만든다. Object가 다시 시작되어도 기존 데이터는 유지된다.

처음에는 `counter`에 행이 없어서 `getViews()`가 0을 반환한다. 첫 증가 요청에서는 조회수 1인 행을 만들고, 그다음부터는 `views = views + 1`로 갱신한다. 값을 읽어 JavaScript에서 계산한 뒤 덮어쓰지 않고, SQL 안에서 바로 증가시키는 방식이다.

### 요청 ID와 증가를 함께 저장하는 이유

`incrementViews()`는 먼저 요청 ID 삽입을 시도한다. `request_id`가 기본 키이므로 같은 값이 이미 있으면 `ON CONFLICT DO NOTHING`에 의해 새 행이 생기지 않는다. `RETURNING` 결과가 비어 있으면 기존 요청으로 판단하고 현재 값만 읽는다.

새 요청일 때는 ID 기록과 조회수 증가를 함께 확정해야 한다. ID만 기록되고 증가에 실패하면 재시도해도 집계되지 않는다. 반대로 숫자만 증가하고 ID를 남기지 못하면 재시도에서 또 증가한다. 그래서 두 작업을 하나의 `transactionSync()`에 넣었다.

| 처리 결과 | 저장 상태 |
| --- | --- |
| 새 ID 기록과 증가 성공 | 요청 ID와 증가한 조회수를 함께 확정 |
| 중간 작업에서 예외 발생 | 트랜잭션 안의 변경을 되돌림 |
| 이미 기록된 ID | 추가 증가 없이 현재 값 조회 |

`transactionSync()`의 콜백은 동기적으로 끝나야 한다. 이 안에 `await fetch(...)` 같은 외부 I/O를 넣지 않는다. SQLite-backed Object의 `sql.exec()`는 동기 API이므로 이 형태로 묶을 수 있다. [SQLite 트랜잭션 API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transactionsync)

### 처리 기록은 언제까지 보관할까

요청 ID도 SQLite에 저장하므로 Object가 재시작되어도 같은 요청을 알아볼 수 있다. 다만 이 구현은 기록을 자동 삭제하지 않는다. 집계된 방문마다 한 행씩 쌓이므로 저장량도 계속 늘어난다.

삭제 기한을 두면 저장량을 줄일 수 있다. 대신 기록을 삭제한 ID가 나중에 재전송되면 다시 집계된다. 보관 기간을 정할 때는 재시도를 어디까지 중복으로 처리할지도 함께 결정해야 한다.

## 4. 게시글 식별자 검증하기

같은 파일에서 클래스 정의 아래에 다음 함수를 추가한다.

```ts
function normalizePostId(value: string | null): string | null {
	if (!value || value.length > 1024) return null;
	try {
		// Accept a pathname (including percent-encoded Korean), never a full URL.
		const decoded = decodeURIComponent(value);
		const match = /^\/posts\/([\p{L}\p{M}\p{N}_-]+)\/?$/u.exec(decoded);
		if (!match) return null;
		const canonical = `/posts/${encodeURIComponent(match[1])}/`;
		return canonical.length <= 1024 ? canonical : null;
	} catch {
		return null;
	}
}
```

이 함수는 경로 형식을 검사하고, 같은 글을 가리키는 값을 하나의 형태로 맞춘다.

| 입력 예 | 처리 결과 |
| --- | --- |
| `/posts/spark-cache/` | 그대로 사용 |
| `/posts/spark-cache` | 마지막 `/`를 붙여 사용 |
| `/posts/한글/` | 한글 부분을 URL 인코딩해서 사용 |
| `https://example.github.io/posts/spark-cache/` | 전체 URL이므로 거절 |
| `/posts/a/b/` | 하위 경로가 여러 단계이므로 거절 |

slug에는 문자·결합 문자·숫자·밑줄·하이픈을 허용한다. 쿼리 문자열이 섞인 경로는 받지 않으며, 입력과 변환된 경로 모두 1024자 이내로 제한한다.

한글 경로는 그대로 받은 값과 URL 인코딩된 값을 같은 형태로 통일한다. 다음 단계의 `URLSearchParams`가 쿼리 문자열을 해석한 뒤, 경로 안에 남아 있는 퍼센트 인코딩을 이 함수에서 처리한다. 브라우저에서 요청 주소를 만들 때도 `URLSearchParams`를 사용하면 된다.

이는 **게시글 경로의 형식 검사**다. 해당 글이 실제로 공개되어 있는지까지 검사하지는 않는다. 자신의 블로그가 날짜별 경로나 다른 slug 문자를 사용한다면 이 함수를 그대로 쓰지 말고 URL 규칙에 맞춰 조정해야 한다.

## 5. HTTP 요청을 Object에 연결하기

마지막으로 같은 파일 아래에 Worker의 `fetch` 핸들러를 추가한다. 외부에서 HTTP 요청이 들어오면 실행되는 부분이다.

코드는 다음 순서로 읽으면 된다.

1. 요청 출처와 API 경로, 메서드를 확인한다.
2. 브라우저의 사전 확인 요청(OPTIONS)에 응답한다.
3. `postId`와 요청 ID의 형식을 검사한다.
4. 해당 게시글의 Object를 찾아 조회하거나 증가시키고, 결과를 JSON으로 반환한다.

```ts
export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim());
		const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
		if (origin && allowedOrigins.includes(origin)) {
			headers.set("Access-Control-Allow-Origin", origin);
		}
		const json = (body: object, status = 200) => Response.json(body, { status, headers });

		// Reject disallowed browser origins before storage access, even for simple POSTs.
		// Requests without Origin (e.g. curl) remain supported; CORS is not authentication.
		if (origin && !allowedOrigins.includes(origin)) {
			return json({ error: "Origin not allowed" }, 403);
		}
		if (url.pathname !== "/api/views") return json({ error: "Not found" }, 404);
		const methods = ["GET", "POST", "OPTIONS"];
		if (!methods.includes(request.method)) {
			headers.set("Allow", methods.join(", "));
			return json({ error: "Method not allowed" }, 405);
		}
		if (request.method === "OPTIONS") {
			const method = request.headers.get("Access-Control-Request-Method");
			if (method && (!methods.includes(method) || method === "OPTIONS")) {
				headers.set("Allow", methods.join(", "));
				return json({ error: "Method not allowed" }, 405);
			}
			const requestedHeaders = request.headers.get("Access-Control-Request-Headers");
			if (requestedHeaders?.split(",").some((value) => !["content-type", "idempotency-key"].includes(value.trim().toLowerCase()))) {
				return json({ error: "Request headers not allowed" }, 400);
			}
			headers.set("Access-Control-Allow-Methods", methods.join(", "));
			headers.set("Access-Control-Allow-Headers", "Content-Type, Idempotency-Key");
			return new Response(null, { status: 204, headers });
		}

		const postId = normalizePostId(url.searchParams.get("postId"));
		if (!postId || url.searchParams.getAll("postId").length !== 1) {
			return json({ error: "Provide one valid postId: /posts/<slug>/ (maximum 1024 characters)" }, 400);
		}
		const requestId = request.headers.get("Idempotency-Key");
		if (request.method === "POST" && (!requestId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))) {
			return json({ error: "POST requires a UUID v4 Idempotency-Key header" }, 400);
		}
		try {
			const counter = env.MY_DURABLE_OBJECT.getByName(postId);
			const views = request.method === "POST" ? await counter.incrementViews(requestId!.toLowerCase()) : await counter.getViews();
			return json({ views });
		} catch (error) {
			console.error("View counter storage request failed", error);
			return json({ error: "View counter temporarily unavailable" }, 503);
		}
	},
} satisfies ExportedHandler<Env>;
```

요청이 들어오면 출처, API 경로, 메서드와 입력을 확인한 뒤 `getByName(postId)`로 해당 글의 Object를 선택한다. 반환받는 stub은 Object의 메서드를 호출하는 통로다. 여기서 `incrementViews()` 또는 `getViews()`를 호출하면 해당 Object에서 작업이 실행된다. [Durable Object namespace와 호출](https://developers.cloudflare.com/durable-objects/api/namespace/)

POST에는 UUID v4 형식의 `Idempotency-Key`를 요구한다. 대소문자만 다른 UUID가 별개 요청이 되지 않도록 소문자로 통일한다. GET에는 요청 ID가 필요 없다. `postId`가 query에 두 번 들어온 경우도 모호한 입력으로 거절한다.

응답은 성공 시 `{"views":129}`, 실패 시 `{"error":"..."}` 형태다. 실패 원인은 HTTP 상태 코드로 구분한다.

| 상태 코드 | 의미 |
| --- | --- |
| 400 | 게시글 ID나 요청 ID 등 입력이 잘못됨 |
| 403 | 허용하지 않은 Origin |
| 404 | 존재하지 않는 API 경로 |
| 405 | 지원하지 않는 요청 메서드 |
| 503 | 저장소 또는 Object 호출 실패 |

503 응답에는 내부 오류 내용을 담지 않는다. 자세한 오류는 서버 로그에 남기고, 브라우저에는 일시적으로 사용할 수 없다는 메시지만 전달한다.

### CORS: 블로그에서 API 응답을 읽도록 허용하기

GitHub Pages와 Worker는 주소가 다르다. 브라우저가 다른 출처의 API 응답을 읽으려면 서버가 허용한다는 응답 헤더를 보내야 한다. 이 코드에서는 `Access-Control-Allow-Origin`에 블로그 Origin을 넣는다.

`Idempotency-Key`처럼 사용자 정의 헤더를 보내면 브라우저가 본 요청 전에 OPTIONS 요청으로 허용 여부를 확인할 수 있다. 이를 **preflight(사전 확인 요청)**라고 한다. Worker는 허용하는 메서드와 헤더를 알려주고, 이 단계에서는 조회수를 올리지 않는다.

이 코드는 허용하지 않은 Origin을 실제 GET·POST에서도 검사한다. 그렇지만 Origin 없는 클라이언트나 헤더를 조작하는 프로그램까지 막는 인증 수단은 아니다. CORS를 설정했다고 조회수 조작이나 봇 호출을 방지했다고 생각하면 안 된다.

### 캐시: 목록에서 보여줄 숫자를 잠시 보관하기

응답의 `Cache-Control: no-store`는 HTTP 캐시에 오래된 조회수를 남기지 않기 위한 설정이다. 3편에서 만들 localStorage 캐시는 브라우저의 HTTP 캐시와 별개다. 목록 표시용 숫자를 애플리케이션 코드가 제한된 시간 동안 보관하는 방식으로 구현할 것이다.

## 6. 타입을 생성하고 로컬에서 확인하기

### 타입 검사

터미널에서 `worker/`로 이동한 뒤 아래 명령을 실행한다. 첫 명령은 설정에 맞는 TypeScript 타입을 생성하고, 두 번째는 코드의 타입 오류를 검사한다.

```sh
npm run cf-typegen
npx tsc --noEmit
```

`Env`를 직접 고치는 대신 Wrangler가 생성하도록 한다. 앞의 세 TypeScript 블록이 모두 같은 `src/index.ts`에 들어 있어야 한다.

### 로컬 API 실행

로컬 블로그는 `http://localhost:1313`에서 실행한다고 가정한다. 로컬 테스트용 Origin은 실행 명령에만 추가한다. 프로덕션 설정의 허용 목록에 localhost를 넣을 필요는 없다.

```sh
npm run dev -- --local \
  --var ALLOWED_ORIGINS:https://example.github.io,http://localhost:1313,http://127.0.0.1:1313
```

위 명령에서도 `https://example.github.io`는 자신의 Origin으로 바꾼다. 1편의 예제 서버가 실행 중이면 `Ctrl+C`로 멈춘 뒤 다시 실행한다. 아래 curl은 다른 터미널에서 실행한다. 아직 운영 환경에 요청하거나 배포하는 단계는 아니다.

### 조회 → 증가 → 같은 요청 재전송

다음 결과는 `/posts/counter-check/`를 처음 사용하는 로컬 저장소를 기준으로 한다. 이미 실행한 적이 있다면 새로운 테스트용 postId로 바꾸거나 기존 값에서 증가하는지 확인한다.

```sh
curl 'http://localhost:8787/api/views?postId=/posts/counter-check/'
# {"views":0}

curl -X POST \
  -H 'Idempotency-Key: 11111111-1111-4111-8111-111111111111' \
  'http://localhost:8787/api/views?postId=/posts/counter-check/'
# {"views":1}

curl -X POST \
  -H 'Idempotency-Key: 11111111-1111-4111-8111-111111111111' \
  'http://localhost:8787/api/views?postId=/posts/counter-check/'
# {"views":1} — 같은 ID이므로 추가 집계하지 않는다.

curl -X POST \
  -H 'Idempotency-Key: 22222222-2222-4222-8222-222222222222' \
  'http://localhost:8787/api/views?postId=/posts/counter-check/'
# {"views":2} — 새로운 ID이므로 1 증가한다.

curl 'http://localhost:8787/api/views?postId=/posts/counter-check/'
# {"views":2}
```

Worker를 멈췄다가 같은 로컬 저장소로 다시 실행해 GET을 보내도 값은 남아 있어야 한다. 앞의 첫 번째 요청 ID를 다시 보내도 추가 증가하지 않아야 한다. 이 검증은 조회수뿐 아니라 처리 기록도 영속 저장되었는지 확인하는 과정이다.

### 잘못된 요청과 preflight 확인

```sh
curl -i 'http://localhost:8787/api/views'
# postId가 없으므로 400

curl -i -X POST \
  'http://localhost:8787/api/views?postId=/posts/counter-check/'
# Idempotency-Key가 없으므로 400

curl -i -X DELETE \
  'http://localhost:8787/api/views?postId=/posts/counter-check/'
# 지원하지 않는 메서드이므로 405

curl -i -X OPTIONS \
  -H 'Origin: http://localhost:1313' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: idempotency-key' \
  'http://localhost:8787/api/views'
# 204 및 Access-Control-Allow-* 응답 헤더
```

본문에서 추출한 코드를 별도 로컬 Worker로 실행해 다음 동작도 확인했다.

- 서로 다른 게시글의 조회수는 독립적으로 저장된다.
- 서로 다른 ID의 POST 50개를 동시에 보내면 조회수가 50 증가한다.
- 같은 ID의 POST 20개를 동시에 보내면 한 번만 증가한다.
- Worker를 재시작해도 조회수와 처리한 요청 ID가 유지된다.

## 서버가 막는 중복과 브라우저가 막을 중복

지금 구현한 서버는 **같은 요청 ID의 재전송**을 막는다. 같은 사람이 새 UUID를 만들어 보내면 새로운 요청으로 집계한다. 따라서 아직 “30분 안에는 다시 집계하지 않는다”는 방문 정책이 적용된 것은 아니다.

브라우저에서는 마지막 집계 성공 후 30분 이내라면 GET만 보내고, 그 시간이 지나면 새 요청 ID를 만들어 POST할 예정이다. 실패한 POST의 ID는 남겨 두었다가 재사용하고, 성공을 확인한 뒤에만 마지막 집계 시각을 기록한다. 이 부분이 있어야 새로고침과 응답 유실을 서로 다르게 다룰 수 있다.

다음 편에서는 이 API를 Hugo 게시글에 연결하고, 목록 일괄 조회와 10분 캐시를 추가한 뒤 Cloudflare와 GitHub Pages에 배포할 것이다.
