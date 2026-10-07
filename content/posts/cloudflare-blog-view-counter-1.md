---
title: "Cloudflare로 GitHub Pages 블로그에 조회수 붙이기 - 1편"
date: 2026-09-28T14:04:27+09:00
draft: false
description: "Cloudflare Workers·Durable Objects의 역할을 이해하고, TypeScript Worker 프로젝트를 생성한다."
categories: ["Cloud"]
tags: ["Cloud", "Cloudflare", "Durable Objects", "Hugo", "GitHub Pages"]
slug: "cloudflare-blog-view-counter-1"
series: "Cloudflare로 블로그에 조회수 붙이기"
seriesOrder: 1
---

GitHub Pages로 운영하는 블로그에 글별 조회수를 붙이고 싶었다. 처음에는 숫자 하나를 읽고 1을 더하면 되는 일처럼 보였다. 그런데 그 숫자를 어디에 저장할지부터 정해야 했다. 브라우저에 저장하면 다른 방문자와 공유할 수 없고, 블로그의 HTML 파일을 바꾸는 방식으로는 방문할 때마다 집계하기 어렵다.

이 블로그에서는 화면은 Hugo와 GitHub Pages에 그대로 두고, 조회수를 처리하는 API만 Cloudflare에 만들었다. API는 Worker가 받고, 게시글별 조회수는 SQLite 저장소를 사용하는 Durable Object에 보관한다. 별도의 데이터베이스 서버를 운영하지 않는 구성이다.

이 과정을 세 편으로 나누어 정리한다. 1편에서는 각 구성 요소가 필요한 이유를 살펴보고 Worker 프로젝트를 생성한다. 2편은 조회수 저장과 API, 중복 집계 처리까지, 3편은 블로그 화면 연결과 목록 캐시, 테스트와 공개 배포를 다룬다.

## 정적 블로그에는 조회수를 어디에 저장할까

Hugo는 Markdown과 템플릿으로 HTML을 만든다. GitHub Pages는 이렇게 만들어진 HTML, CSS, JavaScript 같은 파일을 방문자에게 제공한다. 페이지에 JavaScript를 넣을 수는 있지만, GitHub Pages 자체에서 방문 요청마다 우리의 서버 코드를 실행하고 데이터베이스를 갱신하는 구조는 아니다. [GitHub Pages의 역할](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

HTML에 `조회수 128`을 적으면 배포된 파일을 바꿀 때까지 같은 숫자가 보인다. JavaScript 변수에 숫자를 넣으면 페이지를 새로 열 때 그 값이 사라진다. `localStorage`를 쓰면 브라우저를 닫았다 열어도 값을 남길 수 있지만, 그 저장소는 해당 브라우저의 해당 사이트에 속한다. 내 브라우저의 숫자와 다른 방문자의 숫자를 합쳐 주지는 않는다.

따라서 모든 방문자가 공유하는 조회수는 브라우저 밖에 두어야 한다. 브라우저는 글을 열었을 때 API에 집계를 요청하고, API가 저장된 값을 갱신한 뒤 결과를 돌려준다. 화면은 그 결과를 받아 `조회수 129`처럼 표시한다.

여기서 브라우저 저장소가 불필요해지는 것은 아니다. 나중에 같은 글의 새로고침을 반복 집계하지 않기 위한 방문 기록과, 목록에 표시할 숫자의 임시 복사본을 저장하는 데 쓴다. **전체 조회수의 원본과 한 브라우저의 방문 기록은 서로 다른 데이터다.**

## Cloudflare에서 어떤 기능을 사용할까

### Cloudflare: 이번 API를 실행할 플랫폼

Cloudflare는 CDN, DNS, 보안 서비스뿐 아니라 애플리케이션 코드를 실행하고 데이터를 저장하는 개발 플랫폼도 제공한다. CDN은 여러 지역에서 웹 콘텐츠를 전달하는 데 쓰이고, DNS는 도메인 이름을 서버 주소로 연결하는 데 관여한다. 하지만 이 조회수 기능을 붙이려고 블로그 전체를 Cloudflare로 옮길 필요는 없다.

블로그 주소는 기존 GitHub Pages 주소를 유지한다. Cloudflare에는 조회수 API를 배포하고, 게시글의 JavaScript가 그 API 주소로 요청하게 만든다. 블로그 파일을 전달하는 곳과 조회수를 처리하는 곳이 나뉘는 셈이다. 이 연재에서는 Cloudflare Pages로 사이트를 이전하지 않고, Workers와 Durable Objects를 사용한다.

### Worker: 브라우저의 요청을 받는 코드

Cloudflare Workers는 서버를 직접 준비하고 프로세스를 상시 관리하는 대신, 코드를 배포해 Cloudflare의 실행 환경에서 동작시키는 서비스다. 여기서 Worker는 조회수 API의 입구를 맡는다. 브라우저가 HTTP 요청을 보내면 Worker의 `fetch` 핸들러가 실행되어 응답을 만든다. [Cloudflare Workers](https://developers.cloudflare.com/workers/)

우리가 만들 Worker는 어떤 게시글의 요청인지 확인하고, 입력값이 올바른지 검사한다. 조회 요청이면 현재 숫자를 읽고, 증가 요청이면 저장을 담당하는 코드에 집계를 맡긴다. GitHub Pages와 API의 출처가 다르므로 브라우저가 응답을 읽을 수 있도록 CORS도 처리해야 한다. 구체적인 HTTP 메서드와 CORS 설정은 2편에서 구현한다.

Worker 코드의 전역 변수에 `let views = 0`을 두고 증가시키면 어떨까. 그 값은 실행 중인 메모리에 있을 뿐이다. 다른 실행 인스턴스와 하나의 값을 공유한다고 보장할 수 없고, 실행 환경이 교체되면 유지되지 않는다. 여러 방문자가 공유하고 재시작 뒤에도 남아 있어야 하는 조회수는 영속 저장소에 기록해야 한다.

### Durable Object: 같은 글의 요청과 저장을 한곳에 모으기

Durable Object는 **고유한 ID로 찾아갈 수 있는 실행 단위와, 그 실행 단위에 연결된 영속 저장소**를 함께 제공한다. 단순히 파일을 저장하는 공간이 아니라, 저장된 데이터를 읽고 갱신하는 메서드도 가진다. 같은 namespace 안에서 같은 이름으로 Object를 찾으면 같은 Object로 요청을 보낼 수 있다. [Durable Objects의 구조](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/)

이 특성을 게시글에 대응시키면 이해하기 쉽다.

| 게시글 식별자 | 집계를 담당할 대상 |
| --- | --- |
| `/posts/spark-cache/` | 이 이름에 대응하는 Object |
| `/posts/airflow-xcom/` | 다른 이름에 대응하는 Object |

Spark 글을 읽는 방문자가 여러 명이어도 해당 글의 집계는 같은 Object에 모인다. Airflow 글은 별도 Object가 맡으므로 다른 글의 조회수와 섞이지 않는다. 이것은 이 블로그에서 선택한 데이터 분리 방식이며, 모든 조회수 서비스가 반드시 Object를 글마다 나누어야 한다는 뜻은 아니다.

Durable Object 내부의 메모리도 영구적이지는 않다. 이름에 `Durable`이 붙어 있다고 클래스의 모든 필드가 자동 저장되는 것은 아니다. 재시작 뒤에도 필요한 값은 Storage API를 통해 저장해야 한다. 이 구현은 Object에 연결된 **SQLite 데이터베이스**에 조회수를 기록한다. 각 Object는 자기 저장소를 가지며, 별도의 PostgreSQL이나 MySQL 서버를 연결하지 않는다. [Durable Object의 영속 저장](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)

또 하나는 동시에 들어오는 증가 요청이다. 두 요청이 모두 `128`을 읽고 각각 `129`를 저장하면 방문은 두 번인데 숫자는 한 번만 늘어난다. 같은 Object에 요청을 모으는 것과 함께, 저장 코드에서도 증가를 원자적으로 처리해야 한다. 2편에서는 SQLite 쿼리와 트랜잭션으로 이 부분을 구현한다. Object를 사용한다는 이유만으로 임의의 비동기 코드가 모두 안전해지는 것은 아니다.

## 블로그 화면과 조회수 API가 연결되는 흐름

![GitHub Pages가 HTML과 JavaScript를 브라우저에 제공한다. 브라우저는 Cloudflare Worker에 조회수 API를 요청하고, Worker는 게시글 이름에 해당하는 Durable Object의 SQLite 저장소를 사용한다. 응답은 Worker를 거쳐 브라우저로 돌아온다.](/images/cloudflare-blog-view-counter-1/request-flow.svg)

블로그 페이지를 전달하는 요청과 조회수를 처리하는 요청은 별개다. 먼저 GitHub Pages에서 받은 화면이 열리고, 그 화면의 JavaScript가 Worker에 요청한다. GitHub Pages 서버가 방문할 때마다 Worker를 대신 호출하는 것은 아니다.

예를 들어 `/posts/spark-cache/`를 식별자로 전달하면 Worker가 그 글의 Object를 선택한다. Object가 SQLite에서 값을 읽거나 갱신하고, Worker가 숫자를 JSON 응답으로 돌려준다. 브라우저는 그 응답을 받아 표시한다. 구조도는 이 연재에서 만들 구성을 단순화해 직접 그린 것이다.

Worker와 Durable Object는 역할은 다르지만, 이번에는 하나의 Worker 프로젝트에 코드를 함께 둔다. 별도 서버 두 대를 만들거나 각 글의 데이터베이스를 대시보드에서 하나씩 생성하는 방식은 아니다.

이 조합을 선택한 이유는 조회수를 저장할 데이터와 갱신 로직을 게시글 단위로 모으기 편하기 때문이다. 다른 저장 서비스로도 구현할 수 있지만, 이 연재에서는 선택지를 넓히기보다 이 구성 하나를 실제 배포까지 완성한다. 서버를 직접 운영하지 않는다고 사용량이나 비용이 사라지는 것은 아니며, 요청·저장량과 플랜의 제약은 배포를 다룰 때 확인한다.

## Worker 프로젝트 만들기

### 1. 실행 환경 확인

기존 Hugo 블로그 저장소와 Node.js, npm이 준비되어 있다고 가정한다. Cloudflare 계정은 공개 배포 단계에서 필요하다. 이번 편은 프로젝트 생성과 로컬 예제 실행까지만 진행하므로 로그인이나 운영 환경 배포는 하지 않는다.

```sh
node --version
npm --version
```

이 블로그를 구현할 때 사용한 환경은 Node.js 24.21.0, Wrangler 4.136.1, Hugo 0.164.0이다. 프로젝트 생성 도구는 계속 갱신되므로 `@latest`를 실행한 시점에 따라 설치 버전이나 질문 문구가 다를 수 있다. 이 글의 생성 절차는 C3 2.72.13과 새로 설치된 Wrangler 4.142.0으로도 별도 임시 프로젝트에서 확인했다. Wrangler는 프로젝트에 설치되는 CLI이며, 지원하는 Node.js 환경은 설치 전에 확인하는 편이 좋다. [Wrangler 설치 환경](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

Node.js는 여기서 개발 도구를 실행하는 데 사용한다. 배포된 Worker가 일반적인 Node.js 서버 프로세스로 실행된다는 뜻은 아니다.

### 2. 기존 블로그 안에 프로젝트 생성

터미널을 **블로그 저장소 루트**에서 열고 실행한다. 이미 `worker/`가 있다면 다시 생성하지 말고 기존 프로젝트를 확인한다.

```sh
npm create cloudflare@latest -- worker
```

`create-cloudflare`는 Cloudflare 프로젝트의 시작 파일과 개발 도구를 준비하는 CLI이며, 줄여서 C3라고도 부른다. 이 명령은 블로그 안에 `worker/` 디렉터리를 만든다. Hugo 사이트 자체를 Worker 프로젝트로 바꾸는 명령은 아니다.

생성 과정에서는 다음 항목을 선택한다. 질문의 정확한 문구보다 어떤 종류의 프로젝트를 선택하는지가 중요하다. [Durable Objects 프로젝트 생성](https://developers.cloudflare.com/durable-objects/get-started/)

| 선택 항목 | 선택할 값 |
| --- | --- |
| 시작 방식 | `Hello World example` |
| 템플릿 | `Worker + Durable Objects` |
| 언어 | `TypeScript` |
| Git | 기존 블로그 저장소를 사용하고 별도 저장소는 만들지 않음 |
| 즉시 배포 여부 | `No` |

기존 Git 저장소를 감지하면 Git 관련 질문이 생략되거나 다르게 표시될 수 있다. 새 저장소 초기화를 묻는다면 이 구성에서는 하지 않는다. 같은 선택을 명령으로 지정하고 싶다면 다음과 같이 실행해도 된다. 두 생성 명령 중 하나만 사용한다.

```sh
npm create cloudflare@latest -- worker \
  --type=hello-world-durable-object \
  --lang=ts \
  --no-git \
  --no-deploy
```

`Worker only`가 아니라 Durable Objects가 포함된 템플릿을 고르는 이유는 조회수를 보관할 Object와 이를 호출할 Worker의 시작 구성을 함께 받기 위해서다. `No`로 배포를 미루는 이유는 아직 조회수 API를 작성하지 않았기 때문이다. 현재는 예제 코드를 준비하는 단계다.

### 3. 생성된 파일의 역할 확인

핵심 파일은 다음과 같다. 부가적인 편집기 설정이나 안내 파일은 생성 도구 버전에 따라 달라질 수 있다.

```text
블로그 저장소/
├── content/
├── layouts/
├── assets/
├── hugo.toml
└── worker/
    ├── src/
    │   └── index.ts
    ├── wrangler.jsonc
    ├── package.json
    ├── package-lock.json
    ├── tsconfig.json
    └── worker-configuration.d.ts
```

`src/index.ts`에는 요청을 받는 Worker와 `MyDurableObject` 클래스가 들어 있다. 지금은 예제 동작이지만, 다음 편에서 조회수 로직을 작성할 파일이다.

`wrangler.jsonc`에는 실행할 코드의 위치와 Worker 이름, Durable Object 연결 설정 등이 들어 있다. 코드에서 사용할 Object 연결을 **바인딩(binding)**으로 선언하는 곳이다. 현재 프로젝트에서는 `MY_DURABLE_OBJECT`라는 바인딩이 `MyDurableObject` 클래스를 가리킨다. SQLite 사용 설정과 이름이 어떻게 연결되는지는 2편에서 코드를 작성하며 살펴본다.

`package.json`에는 개발 도구와 실행 명령이, `package-lock.json`에는 설치한 의존성의 구체적인 버전 정보가 기록된다. `tsconfig.json`은 TypeScript 설정이다. `worker-configuration.d.ts`는 Worker 환경과 바인딩을 TypeScript에서 사용할 수 있도록 생성한 타입 정의 파일이다. 생성 시점에 없다면 타입 생성 명령으로 만든다.

여기서 **C3는 프로젝트를 만드는 도구이고, Wrangler는 만들어진 프로젝트를 실행·검증·배포하는 도구**라는 차이도 기억해 두자. 조회수 코드를 수정할 때마다 C3를 다시 실행할 필요는 없다.

### 4. 로컬 예제 실행

이제 `worker/`로 이동한다. 아래 명령들은 이 디렉터리에서 실행한다.

```sh
cd worker
npx wrangler --version
npm run cf-typegen
npm run dev
```

개발 서버가 준비되면 터미널에 로컬 주소가 출력된다. 기본 포트를 그대로 사용했다면 브라우저에서 `http://localhost:8787/`를 연다. 같은 응답을 터미널에서 확인하려면 개발 서버를 켜 둔 상태로 다른 터미널에서 실행한다.

```sh
curl http://localhost:8787/
```

Hello World 예제의 응답이 나오면 Worker 개발 서버와 Object 호출 구성이 동작하는지 확인한 것이다. **아직 조회수가 저장되거나 Hugo 화면에 숫자가 표시되는 단계는 아니다.** 현재 템플릿의 구체적인 응답 문구나 내부 예제 코드는 버전에 따라 달라질 수 있다.

`hugo server`는 블로그 화면을 위한 서버이고, `npm run dev`는 Worker API를 위한 서버다. 이후 두 기능을 연결해 로컬에서 확인할 때는 둘을 각각 실행해야 한다. 로컬 실행 중 만들어지는 Worker 상태는 `.wrangler/` 아래에 보관되며 운영 데이터와 분리된다. 이 폴더와 `node_modules/`, `.env*`, `.dev.vars*`는 Git에 포함하지 않도록 확인한다. 환경변수나 인증정보를 사용하지 않는 현재 단계에서 이를 위한 파일을 따로 만들 필요는 없다.

다음 편에서는 생성한 프로젝트에 SQLite 조회수 저장소와 GET·POST API를 구현하고, 같은 요청이 재전송돼도 한 번만 집계하도록 만들 것이다.
