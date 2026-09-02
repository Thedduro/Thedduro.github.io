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
