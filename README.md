# KUSITMS Makers Calendar (MVP)

Projects, Issues, Sprints, Meetings를 하나의 캘린더에서 보는 Next.js MVP입니다.

## 기능

- Notion 서버 토큰(`NOTION_TOKEN`) 기반 조회
- DB 4개 통합 조회
- 이벤트 타입별 색상 구분
- 타입별 필터 토글
- 이벤트 클릭 시 Notion 원문 열기
- 전역 순번(`KM-<number>`) 기반 티켓 생성 API

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
NOTION_MEETINGS_DB_ID=
NOTION_EPICS_DB_ID=
NOTION_STORIES_DB_ID=
SUPABASE_DB_URL=
DATABASE_URL=
GLOBAL_COUNTER_NAME=km_ticket
CRON_SECRET=
```

DB ID는 Notion URL에서 UUID 부분을 사용하면 됩니다.

`NOTION_EPICS_DB_ID`, `NOTION_STORIES_DB_ID`는 선택값입니다.
없으면 생성 API는 `NOTION_ISSUES_DB_ID`로 fallback합니다.

## 전역 순번 티켓 생성 API

`POST /api/tickets/create`

### Supabase 연결 방법

1. Supabase 프로젝트 생성
2. `Settings -> Database -> Connection string`에서 URI 복사
3. `.env.local`에 `SUPABASE_DB_URL` 설정
4. `GLOBAL_COUNTER_NAME=km_ticket` 유지 또는 원하는 이름으로 변경

`global_counters` 테이블은 API 호출 시 자동 생성됩니다.
원하면 미리 생성해도 됩니다:

```sql
create table if not exists public.global_counters (
  name text primary key,
  value bigint not null
);
```

```json
{
  "type": "Issue",
  "title": "GA 퍼널 이벤트 맵 보완",
  "status": "Backlog",
  "priority": "P1",
  "description": "리크루팅 전환 단계 이벤트 보완",
  "projectIds": ["<notion-page-id>"],
  "sprintIds": ["<notion-page-id>"],
  "parentIds": ["<notion-page-id>"],
  "dueDateStart": "2026-03-01"
}
```

성공 응답 예시:

```json
{
  "globalId": "KM-26",
  "pageId": "<notion-page-id>",
  "pageUrl": "https://www.notion.so/...",
  "databaseId": "<target-database-id>"
}
```

`globalId`는 Postgres `global_counters` 테이블에서 트랜잭션으로 발급되어
DB가 여러 개여도 번호가 겹치지 않습니다.

### 빠른 호출 예시

```bash
curl -X POST http://localhost:3000/api/tickets/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Issue",
    "title": "전역 순번 생성 테스트",
    "status": "Backlog",
    "priority": "P2"
  }'
```

## 노션 수동 생성 이슈 자동 번호 동기화 (5분 주기)

수동으로 만든 Notion 이슈에도 `KM-<number>`를 자동 부여하려면
`/api/cron/sync-global-ids`가 주기적으로 실행됩니다.

- 스케줄: `*/5 * * * *` (5분마다, GitHub Actions)
- 대상 DB: `NOTION_ISSUES_DB_ID` + 선택값(`NOTION_STORIES_DB_ID`, `NOTION_EPICS_DB_ID`)
- 동작:
  - 제목이 `[KM-123]` 형태가 아니고 Global ID가 비어 있으면 새 번호 발급
  - 제목/Global ID 중 하나에 기존 `KM-` 값이 있으면 누락된 쪽만 보정

워크플로우 파일:
- `.github/workflows/sync-global-ids.yml`

GitHub Secrets:
- `SYNC_URL`: `https://<your-domain>/api/cron/sync-global-ids`
- `CRON_SECRET`: 서버 환경변수 `CRON_SECRET`와 같은 값

### 엔드포인트 보안

`CRON_SECRET`를 설정하면 요청 헤더 `Authorization: Bearer <CRON_SECRET>`가 필요합니다.

### 수동 실행 테스트

```bash
curl -X POST "http://localhost:3000/api/cron/sync-global-ids" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 주의

- Integration이 4개 DB에 공유되어 있어야 조회됩니다.
- `NOTION_TOKEN`은 서버에서만 사용됩니다. `.env.local`은 커밋하지 마세요.
