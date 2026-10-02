# Thedduro.github.io

Hugo로 만든 미니멀 기술 블로그입니다.

## 로컬에서 실행

```bash
hugo server -D
```

브라우저에서 <http://localhost:1313>을 열면 저장할 때마다 변경 내용이 자동 반영됩니다.

## 새 글 작성

```bash
hugo new content posts/my-post.md
```

생성된 글을 작성한 뒤 front matter의 `draft: true`를 `draft: false`로 변경하면 실제 빌드에 포함됩니다.

## 사전

`/glossary/`에서 한글·영문·약어·정의를 함께 검색하고 큰 분야의 태그로 필터링할 수 있습니다. 목록은 가나다·ABC 순서로 표시됩니다. 용어는 [`data/glossary.yaml`](data/glossary.yaml) 한 파일의 YAML 배열로 관리합니다. 용어별 Markdown과 상세 페이지는 없으며 JavaScript 없이도 정의와 관련 링크를 읽을 수 있습니다.

각 항목의 `id`는 고유한 영문 식별자, `title`은 완전한 대표 이름, `english`는 같은 범위의 영문명, `abbreviations`는 약어, `term_aliases`는 약어·한글 표기, `description`은 짧은 정의입니다. `tags: [데이터 엔지니어링, 스토리지]`처럼 큰 분야의 태그를 여러 개 지정할 수 있습니다. 제품명·프로토콜명·세부 개념은 태그로 쓰지 않습니다. 등록된 표기를 함께 검색하므로 `데이터 웨어하우스`, `Data Warehouse`, `DW`는 같은 항목을 찾습니다.

`related_posts`에는 `/posts/data-platform-basics-1`처럼 **content 기준의 파일 경로를 확장자 없이** 기록합니다. 공개 URL과 파일명이 달라도 실제 글 제목과 주소로 연결됩니다. `related_terms`에는 다른 용어의 `id`를 적고, `sources`에는 출처의 `title`과 `url`을 기록합니다. 사용하지 않는 배열은 `[]`로 둡니다.

관련 용어는 사전 안에서 이동하며, 게시글의 ‘이 글의 용어’도 `/glossary/#term-<id>`로 연결됩니다. `draft: true`인 용어는 `--buildDrafts`와 관계없이 숨깁니다. 초안·미래 게시글 링크도 노출하지 않습니다. AI의 글 작성·개념 수정 작업에서는 [manage-glossary](.agents/skills/manage-glossary/SKILL.md)가 용어 선별·중복 확인·등록과 연결을 담당합니다.

빌드는 데이터 필수값과 중복 ID·제목, 참조의 존재를 검사합니다. 회귀 검사는 `python3 -B -m unittest discover -s scripts -p 'test_*.py'`로 실행합니다.

## 프로필 수정

사이트 이름과 한 줄 소개, GitHub·LinkedIn 주소는 [`hugo.toml`](./hugo.toml)의 `[params]`에서 관리합니다.

```toml
[params]
  authorName = '임선우'
  profileTitle = 'Data Engineer'
  profileBio = '소개 문구'
  github = 'https://github.com/Thedduro'
  linkedin = 'https://www.linkedin.com/in/선우-임-5634a5341/'
```

LinkedIn 값이 비어 있으면 해당 버튼은 화면에 표시되지 않습니다.

## 프로덕션 빌드

```bash
hugo --gc --minify
```

생성 결과는 `public/` 디렉터리에 저장되며 Git에는 포함되지 않습니다.
