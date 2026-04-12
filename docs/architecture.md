# 진로나침반 백엔드 설계 기준

## 1. 프론트 데이터 흐름 재해석 요약
- `mock.ts`는 읽기 전용 데모 데이터가 아니라 실제 서비스 기준의 초기 조회 API 목록으로 재해석한다.
- `localStorage`는 학생 단말 임시 캐시가 아니라 서버 저장이 누락된 도메인 상태다. 백엔드는 이를 `성적`, `주간 계획`, `알림`, `목표` 엔티티로 흡수한다.
- `StudyPlanContext`는 `StudyPlan + StudyTask` 집계 API로 전환한다.
- `NotificationContext`는 `Notification + SSE`로 전환한다.
- `gradeStorage.ts`는 DB 원천 데이터를 차트 shape로 재조합하는 서버 serializer로 대체한다.
- 학생/교사 페이지는 같은 원천 데이터를 다른 집계로 보여준다. 따라서 읽기 API는 화면 단위 집계 API와 원천 CRUD API를 둘 다 둔다.

## 2. 핵심 리스크와 차단 전략
- 인증 누락: 역할 라우트만 믿으면 바로 우회된다. `JWT access + refresh rotation + DB refresh hash 저장`으로 차단한다.
- 권한 역전: 학생이 다른 학생 성적/메모를 조회할 위험이 있다. `studentProfileId`는 항상 서버에서 재해석하고, 교사는 `TeacherStudentAssignment`가 있어야만 접근 가능하게 한다.
- 성적 혼합 저장: 중간/기말/학기최종/모의를 한 테이블에 섞으면 차트와 통계가 깨진다. 엔터티를 분리한다.
- mock shape 불일치: 프론트 카드/차트 필드명이 달라지면 연동 비용이 커진다. mapper/serializer에서 프론트 shape를 유지한다.
- SSE 인증 실패: 브라우저 `EventSource`는 헤더 제약이 있다. `/v1/sse/token`으로 단기 stream token을 발급하고 `/v1/sse/stream?streamToken=`으로 연결한다.
- SSE 멀티 인스턴스 누락: 현재 코드의 in-memory broker를 그대로 ECS 다중 태스크에 올리면 이벤트 유실이 생긴다. 운영 전에는 Redis pub/sub 또는 SNS fan-out으로 교체한다.
- refresh token 꼬임: 재발급 중복 호출로 세션 상태가 엉킬 수 있다. DB에 `familyId`, `tokenHash`, `status`를 저장해 회전 상태를 추적한다.
- migration 사고: 운영 DB에 바로 `migrate dev`를 쓰면 위험하다. CI는 `prisma validate`, CD는 `prisma migrate deploy`만 허용한다.
- Docker 보안 누락: root 실행, 과도한 mount, daemon TCP 노출은 금지한다. multi-stage, non-root, 최소 패키지, healthcheck를 강제한다.
- AWS 배포 장애: RDS public access, secret 하드코딩, 무검증 롤아웃을 금지한다. ECS/Fargate + private subnet + ALB healthcheck + OIDC 배포로 제한한다.

## 3. 추천 백엔드 아키텍처
- 런타임: Node.js 20 + TypeScript + Express
- 계층: `router -> validator -> service/orchestrator -> prisma -> mapper`
- 공통 경계: `config`, `common`, `infra`, `modules`
- AI 경계: `provider abstraction`, `retriever`, `orchestrator`
- 저장소 경계: PostgreSQL 내부를 `app`, `rag`, `audit` 스키마로 분리
- 실시간 경계: SSE는 HTTP 계층이 아니라 notification/counseling/study-plan 변경 이벤트를 구독하는 얇은 delivery 계층으로 둔다.

## 4. 최종 폴더 구조
```text
backend/
  docs/
    architecture.md
  prisma/
    schema.prisma
    seed.ts
  src/
    app.ts
    server.ts
    routes.ts
    config/
      env.ts
    common/
      domain.ts
      http.ts
    infra/
      prisma.ts
      realtime.ts
      security.ts
    modules/
      admissions.ts
      ai.ts
      auth.ts
      counseling.ts
      dashboard.ts
      goals.ts
      grades.ts
      health.ts
      me.ts
      notifications.ts
      study-plans.ts
  .github/workflows/
    ci.yml
  Dockerfile
  docker-compose.dev.yml
  .env.example
```

## 5. Prisma 엔티티 및 관계 설계
- 계정/프로필: `User`, `StudentProfile`, `TeacherProfile`, `ClassRoom`, `TeacherStudentAssignment`, `RefreshToken`
- 성적: `GradeExamRecord`, `SemesterFinalGrade`, `MockExamResult`
- 학습: `StudyPlan`, `StudyTask`
- 알림/상담: `Notification`, `CounselingRequest`, `CounselingMemo`
- 목표/입시: `GoalSetting`, `University`, `Department`, `AdmissionRecord`
- AI: `AiConversation`, `AiMessage`
- RAG: `RagSource`, `RagDocument`, `RagChunk`, `RagIngestionJob`
- 감사: `AuditLog`
- soft delete는 `User`, `ClassRoom`, `StudyTask`, `CounselingMemo`만 제한 적용한다. 모든 엔터티에 soft delete를 남발하지 않고, 나머지는 상태값과 audit log로 추적한다.

## 6. API 명세 초안
- `POST /v1/auth/student/signup`
- `POST /v1/auth/teacher/signup`
- `POST /v1/auth/student/login`
- `POST /v1/auth/teacher/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`
- `POST /v1/auth/invite/validate`
- `GET /v1/me`
- `PATCH /v1/me`
- `GET /v1/students`
- `GET /v1/students/:studentId`
- `GET /v1/teachers/me`
- `GET /v1/classrooms/me`
- `POST /v1/grades/exams`
- `POST /v1/semester-finals`
- `POST /v1/mock-exams`
- `GET /v1/grades/chart`
- `GET /v1/growth-report`
- `GET /v1/study-plans/current`
- `POST /v1/study-plans/current/tasks`
- `PATCH /v1/study-plans/current/tasks/:taskId`
- `DELETE /v1/study-plans/current/tasks/:taskId`
- `GET /v1/notifications`
- `PATCH /v1/notifications/:notificationId/read`
- `PATCH /v1/notifications/read-all`
- `GET /v1/counseling/requests`
- `POST /v1/counseling/requests`
- `PATCH /v1/counseling/requests/:requestId/status`
- `GET /v1/counseling/memos`
- `POST /v1/counseling/memos`
- `PATCH /v1/counseling/memos/:memoId`
- `DELETE /v1/counseling/memos/:memoId`
- `GET /v1/goals/current`
- `PUT /v1/goals/current`
- `DELETE /v1/goals/current`
- `GET /v1/goals/options`
- `GET /v1/admissions`
- `GET /v1/student/dashboard`
- `GET /v1/teacher/dashboard`
- `GET /v1/completion-status`
- `POST /v1/ai/chat`
- `POST /v1/ai/career-chat`
- `POST /v1/rag/query`
- `GET /health`
- `GET /health/ready`

## 7. 공통 응답 / 에러 포맷
```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "uuid"
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": []
  },
  "requestId": "uuid"
}
```

에러 코드는 `VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`로 제한한다.

## 8. 인증 / 인가 설계
- Access token: 15분
- Refresh token: 14일, DB hash 저장, 회전 방식
- Stream token: 60초, SSE 전용
- 학생은 자신의 `StudentProfile`만 접근 가능
- 교사는 `TeacherStudentAssignment.active = true`인 학생만 접근 가능
- 관리자 범위는 모델에 남겨두되 실제 운영 전용 경로가 정리되기 전까지는 최소화한다.

## 9. SSE 설계
- 엔드포인트: `GET /v1/sse/stream?streamToken=...`
- 토큰 발급: `GET /v1/sse/token`
- 이벤트명: `notification.created`, `notification.updated`, `study-plan.updated`, `counseling.request.created`, `counseling.request.updated`, `counseling.memo.created`, `system.ready`, `ping`
- heartbeat: `SSE_HEARTBEAT_INTERVAL_MS`
- 재연결: 응답에 `retry` 값 포함
- 현재 구현은 in-memory broker다. 운영 전 Redis-backed broker로 교체해야 한다.

## 10. AI / RAG / 오케스트레이터 설계
- LLM: `LlmProvider` 인터페이스 + `StubLlmProvider`
- RAG: `RagRetriever` 인터페이스 + `StubRagRetriever`
- 오케스트레이터: 질의 텍스트 기준으로 `LLM`, `RAG`, `HYBRID` 결정
- `/ai/chat`: 일반 상담 + 혼합 질의
- `/ai/career-chat`: 진로 탐색 전용
- `/rag/query`: 입시 근거 조회 전용
- 모든 AI 응답은 `citations[]`, `meta.provider`, `meta.model`, `meta.isStub`를 반환한다.

## 11. Docker / docker-compose 설계
- `Dockerfile`: multi-stage build, non-root user, production 이미지 최소화
- `docker-compose.dev.yml`: `postgres` + `backend`
- `healthcheck`: `/health`
- dev compose는 bind mount를 사용하지만 운영 이미지는 코드 write 권한 없이 실행한다.
- Docker daemon 외부 TCP 노출, privileged, host network, broad bind mount는 금지한다.

## 12. CI/CD 설계
- CI: Node 20, PostgreSQL service, `npm install`, `prisma validate`, `prisma generate`, `typecheck`, `build`, `docker build`
- Postgres service는 `SELECT 1` 수준 연결 검증부터 시작하고, 첫 migration 이후 integration test를 추가한다.
- CD: `develop`는 staging, `main`은 production
- GitHub Actions AWS 인증은 OIDC 기반
- 운영 반영 전 `prisma migrate deploy` 실행, ALB healthcheck 성공 후 완료

## 13. AWS 배포 구조
- 배포 대상: ECS/Fargate
- 이유: EC2보다 운영 표면적이 작고, Docker daemon 직접 운영 위험이 낮다.
- ALB가 HTTPS 종료와 healthcheck 수행
- ECS task는 private subnet
- RDS PostgreSQL은 private subnet + public access disabled
- 보안 그룹은 `ALB -> ECS`, `ECS -> RDS`만 허용
- 로그는 CloudWatch
- Nginx는 별도 두지 않는다. Express + ALB로 충분하다.
- 단, SSE를 다중 태스크로 확장할 때는 shared pub/sub가 반드시 필요하다.

## 14. 환경변수 목록
- `PORT`
- `NODE_ENV`
- `APP_BASE_URL`
- `LOG_LEVEL`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_STREAM_SECRET`
- `JWT_ACCESS_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `JWT_STREAM_EXPIRES_IN`
- `REFRESH_TOKEN_COOKIE_NAME`
- `ACCESS_TOKEN_HEADER_NAME`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `AUTH_RATE_LIMIT_MAX`
- `SSE_HEARTBEAT_INTERVAL_MS`
- `SSE_RETRY_INTERVAL_MS`
- `AI_PROVIDER`
- `AI_API_KEY`
- `AI_MODEL_DEFAULT`
- `AI_EMBEDDING_MODEL`
- `AI_REQUEST_TIMEOUT_MS`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_SECRETS_PREFIX`

## 15. 프론트 mock/localStorage/context -> API/DB 매핑표
| 프론트 원천 | 백엔드 API | DB 엔티티 |
|---|---|---|
| `STUDENTS` | `/v1/students`, `/v1/teacher/dashboard` | `StudentProfile`, `GoalSetting`, `StudyPlan`, `CounselingRequest` |
| `GRADE_DATA` | `/v1/grades/chart?mode=final` | `SemesterFinalGrade` |
| `TEACHER_GRADE_DATA` | `/v1/students`, 추후 `/v1/grades/compare` | `SemesterFinalGrade`, `StudentProfile.currentAverageGrade` |
| `WEEKLY_PLAN` | `/v1/study-plans/current` | `StudyPlan`, `StudyTask` |
| `ALERTS` | `/v1/notifications` | `Notification` |
| `UNIVERSITIES`, `DEPARTMENTS_BY_FIELD` | `/v1/goals/options` | `University`, `Department` |
| `ADMISSIONS_DATA` | `/v1/admissions` | `AdmissionRecord`, `University`, `Department` |
| `COUNSELING_REQUESTS` | `/v1/counseling/requests` | `CounselingRequest` |
| `COMPLETION_TREND` | `/v1/completion-status` | `StudyPlan.completionRate` |
| `jinro_grade_data` | `/v1/grades/exams`, `/v1/semester-finals`, `/v1/mock-exams` | `GradeExamRecord`, `SemesterFinalGrade`, `MockExamResult` |
| `jinro_study_tasks` | `/v1/study-plans/current/*` | `StudyPlan`, `StudyTask` |
| `jinro_pending_*`, `jinro_shown_*` | `/v1/notifications`, `/v1/sse/stream` | `Notification` |
| `jinro_student_goal`, `jinro_teacher_goal_alerts` | `/v1/goals/current`, `/v1/notifications` | `GoalSetting`, `Notification` |
| `StudyPlanContext` | `/v1/study-plans/current` | `StudyPlan`, `StudyTask` |
| `NotificationContext` | `/v1/notifications`, `/v1/sse/stream` | `Notification` |

## 16. 실제 생성할 파일 목록
- `package.json`
- `tsconfig.json`
- `.gitignore`
- `.dockerignore`
- `.env.example`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/app.ts`
- `src/server.ts`
- `src/routes.ts`
- `src/config/env.ts`
- `src/common/http.ts`
- `src/common/domain.ts`
- `src/infra/prisma.ts`
- `src/infra/security.ts`
- `src/infra/realtime.ts`
- `src/modules/health.ts`
- `src/modules/auth.ts`
- `src/modules/me.ts`
- `src/modules/study-plans.ts`
- `src/modules/notifications.ts`
- `src/modules/grades.ts`
- `src/modules/goals.ts`
- `src/modules/counseling.ts`
- `src/modules/dashboard.ts`
- `src/modules/admissions.ts`
- `src/modules/ai.ts`
- `.github/workflows/ci.yml`
- `Dockerfile`
- `docker-compose.dev.yml`

## 17. 가장 먼저 생성할 코드 순서
1. 환경변수, 앱 부트스트랩, 공통 에러/응답, 보안 미들웨어
2. Prisma 스키마와 DB 경계
3. 인증/세션/refresh rotation
4. `me`, `study-plans`, `notifications`, `sse`
5. 성적 입력/차트 serializer
6. 목표 설정 + 교사 알림
7. 상담 요청/메모
8. 학생/교사 대시보드 집계
9. 입시 조회 API
10. AI provider abstraction + RAG retriever + orchestrator
11. Docker/CI/CD/AWS 배포 파이프라인
