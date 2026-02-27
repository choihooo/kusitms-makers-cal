# KUSITMS Makers Calendar (MVP)

Projects, Issues, Sprints, Releases를 하나의 캘린더에서 보는 Next.js MVP입니다.

## 기능

- Notion 서버 토큰(`NOTION_TOKEN`) 기반 조회
- DB 4개 통합 조회
- 이벤트 타입별 색상 구분
- 타입별 필터 토글
- 이벤트 클릭 시 Notion 원문 열기

## 로컬 실행

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 환경 변수

`.env.local`에 아래 값이 필요합니다.

```env
NOTION_TOKEN=
NOTION_PROJECTS_DB_ID=
NOTION_ISSUES_DB_ID=
NOTION_SPRINTS_DB_ID=
NOTION_RELEASES_DB_ID=
```

DB ID는 Notion URL에서 UUID 부분을 사용하면 됩니다.

## 주의

- Integration이 4개 DB에 공유되어 있어야 조회됩니다.
- `NOTION_TOKEN`은 서버에서만 사용됩니다. `.env.local`은 커밋하지 마세요.
- OAuth 라우트는 남겨뒀지만 현재 기본 동작에는 필요하지 않습니다.
