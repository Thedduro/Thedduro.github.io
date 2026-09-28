# Worker 작업 진입점

이 디렉터리는 GitHub Pages 블로그의 게시글 조회수 API다. `src/`는 TypeScript Worker와 Durable Object, `wrangler.jsonc`는 바인딩·SQLite migration, `test/`는 로컬 검증을 담당한다.

Cloudflare Worker / Durable Objects 구현·수정·검증 및 Hugo 연동 시 [develop-cloudflare-worker](../.agents/skills/develop-cloudflare-worker/SKILL.md)를 읽고 적용한다. 프로젝트 공통 원칙은 루트 [AGENTS.md](../AGENTS.md)를 따른다.
