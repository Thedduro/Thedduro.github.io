---
name: optimize-search-seo
description: 이 Hugo 블로그의 Google·Bing 검색을 위한 공통 메타데이터, 크롤링·색인 설정과 게시글 정보 구조를 구현·검증한다. 사이트 SEO 변경과 게시글 작성·수정·검수에서 참조한다.
---

# 검색엔진을 위한 사이트와 게시글

Google·Bing 등 일반 검색엔진이 글을 발견하고 읽고 색인할 수 있게 하는 것이 우선이다. AI 검색은 표준 구조와 정확하고 읽기 쉬운 콘텐츠를 통해 함께 개선한다. 코드 검증·배포·검색 색인·검색어별 노출은 서로 다른 상태로 보고한다.

## 범위와 역할

- 사이트 작업은 `hugo.toml`, `layouts/partials/head.html`, `layouts/partials/seo/`, robots·RSS·배포 workflow의 실제 상태부터 확인한다. 기존 정상 기능을 재구현하지 않는다.
- 글 작업에서는 대상 Markdown과 관련 자산에만 적용한다. 이 skill의 참조가 다른 게시물·사이트 설정 변경이나 커밋·push·배포를 허용하지는 않는다.
- 문체와 예제 작성은 [write-tech-post](../write-tech-post/SKILL.md), 기술·문체 검수는 [review-tech-post](../review-tech-post/SKILL.md), 이미지 제작·배치·alt 작성은 [prepare-post-visuals](../prepare-post-visuals/SKILL.md)가 담당한다. 제목·설명·URL·날짜의 검색 정책은 이 문서에서 관리한다.

## 게시글 메타데이터

- `title`은 실제 다루는 기술과 문제를 구체적으로 나타낸다. 고정 글자 수를 맞추려고 의미를 훼손하거나 검색어를 반복하지 않는다.
- `description`은 문제와 독자가 얻을 답을 담은 글별 짧은 설명이다. 공개 글은 비워 두지 않는다. 사이트 공통 설명으로 대신하지 않으며 검색 결과에 그대로 표시된다고 보장하지 않는다.
- 새 글은 `hugo new content posts/<영문-소문자-하이픈>.md`로 생성한다. `archetypes/posts.md`가 파일명 기반 `slug`를 제공한다. 현재 URL은 `/posts/:slug/`이며 slug가 없으면 제목을 사용한다. 신규 URL 중복을 확인하고 공개 후에는 slug를 고정한다.
- 기존 공개 URL은 보존한다. 변경 요청이 있을 때만 이전 주소의 이동 처리·내부 링크·canonical·sitemap을 함께 검토한다. Hugo alias를 HTTP 301이라고 설명하지 않는다.
- `date`는 실제 작성·게시 의도에 맞게 기록하고, 별도 `publishDate`가 있으면 최초 공개 시점을 나타낸다. 초안은 `draft: true`로 유지한다. 미래 날짜만으로 예약 배포가 되지는 않는다.
- `lastmod`는 실질적인 내용 변경 때만 추가·갱신한다. 날짜는 `2026-09-28T14:30:00+09:00` 같은 ISO 8601 시간대를 포함한다. 게시일 이전 날짜나 빌드·파일 복사 시각을 쓰지 않는다. 수정일 기록이 없으면 템플릿은 게시일을 사용한다.
- 작성자는 사이트 `authorName`과 `/about/`을 재사용한다. 메타 태그·JSON-LD·canonical HTML을 Markdown에 복사하지 않는다.
- 실제 대표 이미지가 있을 때만 `images: ["/images/<slug>/cover.png"]`, `imageAlt: "그림의 핵심 의미"`를 지정한다. 본문과 관련 있고 접근 가능한 파일이어야 한다. 공유 서비스가 지원하는 이미지 형식을 확인하고, 프로필·로고를 모든 글의 대표 이미지로 대신하지 않는다.

## 본문 정보 구조

문제·질문 → 핵심 답변 → 원인·개념 → 해결 방법 → 실제 코드·예제 → 결과 → 주의사항 → 정리의 흐름에서 주제에 필요한 정보를 제공한다. 핵심 답변과 적용 조건을 초반에 제시하되 모든 글에 같은 8개 소제목을 강제하지 않는다. 관련 절은 합치고 불필요한 절은 생략한다.

- 템플릿이 H1을 출력하므로 본문은 H2부터 시작하고 하위 설명에 H3를 사용한다. 제목 수준을 글자 크기 조절에 사용하지 않는다.
- 버전·환경·성립 조건은 주장 가까이에 쓴다. 사실·판단·예상 결과·실제 관측 결과를 구분하며 검증되지 않은 경험이나 수치를 채워 넣지 않는다.
- 핵심 설명을 이미지·코드에만 넣지 않는다. 코드 전후에 입력·동작·결과·제약을 설명하고 코드 블록의 언어를 지정한다.
- 내부 링크는 관련 있는 기존 공개 글로 연결한다. 파일명으로 주소를 추정하지 않고 permalink와 앵커를 확인한다. 링크 개수를 채우기 위해 초안·무관한 글을 연결하지 않는다.
- alt는 이미지의 핵심 의미를 설명한다. 장식 이미지의 빈 alt는 허용한다. 결론과 요약은 독자의 판단·다음 행동에 필요한 경우에만 넣는다.

## 공통 출력 정책

- title·description·canonical·OG/Twitter는 공통 head에서 한 번만 출력한다. JSON-LD는 공개 게시글에만 `BlogPosting`으로 생성하고 Hugo `jsonify`로 직렬화한다. 제목·설명·작성자·날짜·이미지는 실제 표시 내용과 일치해야 한다.
- Hugo 기본 sitemap 생성은 유지한다. robots.txt에는 baseURL 기반 sitemap을 명시하고 공개 페이지·CSS·JavaScript·이미지를 차단하지 않는다. robots 차단과 noindex는 서로 대체하지 않는다.
- 프로덕션은 초안·미래 글을 제외한다. 404·초안 미리보기·`hugo server`에는 noindex를 적용한다. 정상 공개 페이지에 노출 제한을 임의로 추가하지 않는다.
- 홈 RSS는 게시글만 포함하고 날짜 없는 소개 페이지를 항목으로 내보내지 않는다. 피드 개수 제한과 의도적인 sitemap 제외는 허용한다. RSS·OG·JSON-LD를 색인 필수 조건으로 주장하지 않는다.
- 비표준 AI 태그·llms.txt·숨겨진 요약·키워드 반복을 기본 SEO 조치로 추가하지 않는다. 검색 크롤러와 학습 크롤러 정책도 혼동하지 않는다.

## 검증과 검색 등록

1. 프로덕션은 `hugo --gc --minify` 후 `python3 scripts/check-seo.py public`으로 검사한다. 생성물을 직접 수정하지 않는다. 원본 보존이 필요하면 Review의 임시 복사본 빌드 절차를 따른다.
2. 초안은 별도 `--buildDrafts` 출력에서 렌더링과 noindex를 확인한다. 프로덕션 검사기를 초안 포함 출력에 적용하지 않는다. 검사기는 메타데이터·날짜·JSON·내부 링크·피드 오류를 확인하며 모든 HTML의 sitemap 포함이나 모든 글의 RSS 포함을 강제하지 않는다.
3. 사이트 작업에서는 기존 조회수 UI·스크립트와 게시글 URL이 유지되는지 확인한다. 로컬 HTML/JSON 검사를 실제 Google 색인 확인이나 Rich Results Test 실행으로 보고하지 않는다.
4. 배포가 요청 범위에 포함된 경우 실제 사이트의 HTTP 응답·robots·sitemap을 확인한다. Search Console에서 `https://thedduro.github.io/` URL 접두어 속성의 소유권·sitemap·게시글 URL 검사 상태를 확인한다. 등록 여부는 저장소에 확인 태그가 없다는 이유만으로 단정하지 않는다.
5. HTML 태그로 소유권을 확인한다면 서비스가 발급한 실제 content 값만 `params.googleSiteVerification` 또는 `params.bingSiteVerification`에 설정한다. 임의 토큰을 만들거나 계정 비밀정보를 넣지 않는다. 인증 완료 후 해당 확인 수단을 유지한다.
6. Google Search Console과 Bing Webmaster Tools에 `https://thedduro.github.io/sitemap.xml`을 제출한다. URL 검사 결과에 따라 미발견·수집 실패·미색인·색인 완료를 구분해 처리하고 필요하면 색인을 요청한다. 제목 검색 결과가 없다는 사실만으로 미색인 원인을 단정하거나 등록·요청 후 즉시 노출을 약속하지 않는다.

정책이 불확실하면 [research-tech-topic](../research-tech-topic/SKILL.md)으로 필요한 쟁점만 확인한다. 공식 근거: [Google SEO 기본 가이드](https://developers.google.com/search/docs/fundamentals/seo-starter-guide), [Article 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/article), [URL 검사](https://support.google.com/webmasters/answer/9012289), [재크롤링 요청](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [Bing Webmaster Guidelines](https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a).
