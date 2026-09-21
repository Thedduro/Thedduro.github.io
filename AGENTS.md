# AI 작업 진입점

## 프로젝트 목적

Hugo와 GitHub Pages로 운영하는 개인 기술 블로그다. 개발자가 공부하고 이해한 내용을 정리하는 것이 목적이며, 조사·작성·검수의 세부 규칙은 아래 Skills에서 관리한다.

## 주요 디렉터리

| 경로 | 역할 |
| --- | --- |
| `content/posts/` | 게시물 Markdown 원본과 글 목록 `_index.md` |
| `content/about.md`, `content/tags/` | 소개 페이지와 태그 목록 |
| `archetypes/`, `hugo.toml` | 새 글 템플릿과 사이트 설정 |
| `layouts/`, `assets/` | 자체 Hugo 템플릿, CSS, JavaScript |
| `static/` | 이미지 등 그대로 배포하는 정적 파일 |
| `public/`, `resources/_gen/` | 빌드 결과와 생성 리소스 |
| `.github/workflows/` | GitHub Pages 빌드·배포 |
| `.agents/skills/` | 기술 조사·게시물 작성·검수 지침 |

## 공통 원칙

- 사용자 요청의 범위와 기존 작업을 존중한다. 새 글 작성 시 기존 게시물을 임의로 고치지 않는다. 검수·수정 요청은 지정된 글에 한해 필요한 수정을 포함한다. 사용자가 읽기 전용 검토를 요청하면 수정하지 않는다.
- 원본 콘텐츠와 현재 설정을 기준으로 작업한다. 생성물을 직접 편집하거나 과거 생성물을 현재 규칙으로 간주하지 않는다.
- 글 작업을 이유로 애플리케이션 코드, 설정, 다른 게시물까지 변경하지 않는다. 커밋·push·배포는 요청 범위에 포함된 경우에만 수행한다.
- 특정 작업의 새 요구사항은 해당 Skill에 추가한다. 이 파일은 프로젝트 목적·구조·공통 원칙·Routing만 유지한다.

## Skills와 Routing

요청에 해당하는 `SKILL.md`를 읽고 적용한다. 아래 경로는 저장소 루트 기준이며, 사용자가 특정 Skill을 지정하면 해당 Skill을 우선 적용한다.

| Skill | 책임과 적용 요청 |
| --- | --- |
| [research-tech-topic](.agents/skills/research-tech-topic/SKILL.md) | 기술 조사, 사실 검증, 버전·API 차이 확인 |
| [write-tech-post](.agents/skills/write-tech-post/SKILL.md) | 새 기술 게시물의 문체 파악, 구성과 초안 작성 |
| [prepare-post-visuals](.agents/skills/prepare-post-visuals/SKILL.md) | 게시물 작성·수정 중 기술 개념의 이해를 돕는 시각 자료가 필요할 때 판단과 준비 |
| [review-tech-post](.agents/skills/review-tech-post/SKILL.md) | 새 초안 또는 기존 글의 기술·문체 검수와 필요한 수정 |

## Workflow

- **기술 블로그 작성:** 필요한 경우 research-tech-topic → write-tech-post → review-tech-post → 검수된 최종 Markdown 저장. 제공된 근거가 충분하면 조사를 중복하지 않는다.
- **단순 기술 조사:** research-tech-topic → 조사 결과 전달. 게시물을 자동 생성하지 않는다.
- **기존 게시물 검수:** review-tech-post → 대상 글의 문제를 수정하고 검수 결과 전달.
- **기존 게시물 수정:** review-tech-post를 기준으로 검수 → 요청과 관련된 부분만 수정 → 수정 부분 재확인.
- 작성·수정 중 시각 자료가 필요하다고 판단되면 prepare-post-visuals를 사용한다. 작성에서는 초안 이후 최종 검수 전에 적용하고, 검수 중 필요해졌다면 적용 후 변경 부분을 다시 검수한다. 세부 시각 자료 규칙은 해당 Skill에 위임하며, 필요하지 않으면 이 단계를 생략한다.
- 작성·검수 중 사실 확인이 필요하면 research-tech-topic으로 해당 쟁점만 확인한 뒤 원래 단계로 돌아온다. 검수는 기술과 문체를 별도로 확인하며, 완료된 단계를 이유 없이 반복하지 않는다.
