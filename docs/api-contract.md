# 진로나침반 Backend API Contract

## 1. 공통 규칙

- Base URL: `/v1`
- 요청 `Content-Type`: `application/json`
- 응답 `Content-Type`: `application/json; charset=utf-8`
- 인증이 필요한 API는 `Authorization: Bearer <accessToken>` 사용
- SSE는 `GET /v1/sse/stream?streamToken=<token>` 또는 `Authorization` 헤더 둘 다 허용한다
- 날짜/시간 포맷:
  - 일시: ISO 8601 UTC 문자열 예) `2026-04-12T09:12:31.114Z`
  - 날짜 전용: `YYYY-MM-DD`
- nullable 필드는 예시에서 `null`로 표기한다
- 목록 pagination 공통 규격:
  ```json
  {
    "meta": {
      "pagination": {
        "page": 1,
        "pageSize": 20,
        "totalItems": 42,
        "totalPages": 3,
        "hasNext": true,
        "hasPrev": false
      }
    }
  }
  ```

## 2. 공통 성공 / 실패 포맷

### 성공

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "660d6f39-17cf-471b-a7ea-0d2d8dd9f85f"
}
```

### 실패

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "path": "email",
        "message": "Invalid email",
        "code": "invalid_string"
      }
    ]
  },
  "requestId": "660d6f39-17cf-471b-a7ea-0d2d8dd9f85f"
}
```

## 3. 에러 계약

| code | status | 발생 조건 | 프론트 처리 메모 |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | `400` | body/query/params 검증 실패 | 입력 폼 오류 표시, 저장 중단 |
| `AUTHENTICATION_ERROR` | `401` | 토큰 없음, 만료, refresh token 오류 | refresh 시도 후 실패하면 로그인 이동 |
| `FORBIDDEN` | `403` | 역할 불일치, 담당 학생 아님 | 권한 안내, 화면 유지 |
| `NOT_FOUND` | `404` | 리소스 없음, 담당 학생 없음 | empty state 또는 뒤로가기 |
| `CONFLICT` | `409` | 중복 이메일, 담임 미배정 학생 등 | 사용자에게 충돌 안내 |
| `RATE_LIMITED` | `429` | rate limit 초과 | 짧은 재시도 안내 |
| `INTERNAL_ERROR` | `500` | 예기치 않은 서버 오류 | 공통 에러 토스트 |

### 예시

#### AUTHENTICATION_ERROR

```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication token is invalid."
  },
  "requestId": "13ce6b6a-e0ae-4dd3-83c6-3044a7e8e2b6"
}
```

#### FORBIDDEN

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Teacher is not assigned to this student."
  },
  "requestId": "7673103d-79d1-4582-aec7-cbb7cc6ca1ab"
}
```

## 4. 인증 계약

| method | path | 설명 | auth | role | 사용 화면 |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/student/signup` | 학생 회원가입 | 없음 | 공개 | 학생 회원가입 |
| `POST` | `/auth/teacher/signup` | 교사 회원가입 | 없음 | 공개 | 교사 회원가입 |
| `POST` | `/auth/student/login` | 학생 로그인 | 없음 | 공개 | 학생 로그인 |
| `POST` | `/auth/teacher/login` | 교사 로그인 | 없음 | 공개 | 교사 로그인 |
| `POST` | `/auth/refresh` | access/refresh/stream 재발급 | 없음 | 공개 | 공통 세션 갱신 |
| `POST` | `/auth/logout` | refresh token 폐기 | 없음 | 공개 | 공통 로그아웃 |
| `POST` | `/auth/invite/validate` | 담임 반 초대코드 검증 | 없음 | 공개 | 학생 회원가입 |
| `GET` | `/me` | 현재 세션 사용자 조회 | 필요 | `student/teacher/admin` | My Page, 앱 부트 |
| `PATCH` | `/me` | 현재 사용자 프로필 수정 | 필요 | `student/teacher/admin` | My Page |

### 전달 방식

- access token:
  - 응답 body에 포함
  - 이후 요청 시 `Authorization: Bearer <accessToken>`
- refresh token:
  - 응답 body에 포함
  - 동시에 `HttpOnly` cookie(`jinro_refresh_token`)도 내려감
  - 현재 refresh API는 body의 `refreshToken`을 사용
- stream token:
  - 로그인/refresh/me/notifications list에서 획득 가능
  - EventSource 연결 시 query string에 실어 사용

### 만료 시 재발급 흐름

1. API 호출이 `401 AUTHENTICATION_ERROR`
2. `POST /v1/auth/refresh` 호출
3. 성공 시 새 `accessToken`, `refreshToken`, `streamToken`으로 교체
4. 실패 시 로그인 화면 이동

### 로그인 응답 예시

```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "streamToken": "<jwt>",
    "nextPath": "/student/dashboard",
    "user": {
      "id": "4d3f4d56-6f62-4a80-8be6-34b8d5dcefa1",
      "role": "student",
      "email": "student.seed@jinro.local",
      "name": "김학생",
      "schoolName": "진로나침반고",
      "grade": "2학년",
      "track": "인문계열",
      "onboardingCompleted": true
    }
  },
  "requestId": "5a6726d4-8cdf-48eb-8ef1-c4c59fd3ea0f"
}
```

## 5. SSE 계약

### 엔드포인트

| method | path | 설명 | auth | role | 화면 |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/sse/token` | stream token 발급 | 필요 | 전역 | Notifications, Alert Center |
| `GET` | `/sse/stream?streamToken=<token>` | SSE 스트림 연결 | 필요 | 전역 | Notifications, Weekly Plan, Counseling |

### 연결 규칙

- Query: `streamToken=<jwt>`
- Retry: 서버가 `retry: <ms>` 전송, 현재 `3000`
- Heartbeat: `event: ping`, interval 기본 `15000ms`
- 최초 연결 이벤트: `event: system.ready`

### event name 목록

| event | role | payload |
| --- | --- | --- |
| `system.ready` | student, teacher | 연결 확인 |
| `ping` | student, teacher | heartbeat |
| `study-plan.updated` | student, teacher(대상 학생) | 학습 계획 변경 |
| `notification.created` | teacher | 목표 저장 등으로 생성된 알림 |
| `notification.updated` | student, teacher | 알림 읽음 상태 변경 |
| `notification.bulk-read` | student, teacher | 전체 읽음 처리 |
| `counseling.request.created` | teacher | 학생 상담 요청 생성 |
| `counseling.request.updated` | student | 상담 요청 상태 변경 |
| `counseling.memo.created` | student | 학생 공유 메모 생성 |

### payload 예시

```json
{
  "studyPlanId": "f8f5528f-cce5-4d68-a470-1828cb7646b9",
  "taskId": "4c2ebec4-c9f2-423e-ae2a-aa43be0c07e2",
  "done": true
}
```

```json
{
  "notificationId": "fce0e051-a527-46b7-b771-d8f6a2f018ab",
  "category": "진로",
  "title": "목표 변경 알림"
}
```

```json
{
  "requestId": "90cf9b4a-e9a2-4fcb-bb2b-e75205061329",
  "status": "in_progress"
}
```

## 6. 화면 기준 매핑

| 화면 | 최초 진입 API | 저장/액션 API | SSE | 대체 소스 | 응답 shape 주의점 |
| --- | --- | --- | --- | --- | --- |
| `student/dashboard` | `GET /student/dashboard` | 없음 | 선택 | `mock.ts` | `stats`, `todayTasks`, `recentAlerts` 그대로 사용 |
| `teacher/dashboard` | `GET /teacher/dashboard` | 없음 | 선택 | `mock.ts` | `classroom`, `stats`, `students`, `counselingRequests` |
| `grade input` | `GET /growth-report`, `GET /grades/chart?mode=*` | `POST /grades/exams`, `POST /semester-finals`, `POST /mock-exams` | 불필요 | `jinro_grade_data` | `examType`, `semester`, `subjects[]` |
| `grade trend` | `GET /grades/chart?mode=final|exam|practice` | 없음 | 불필요 | `mock.ts`, `gradeStorage.ts` | `data[]` + `lines[]` |
| `growth report` | `GET /growth-report` | 없음 | 불필요 | `gradeStorage.ts` | `bestSubject`, `worstSubject`, `latestSubjects` |
| `weekly plan` | `GET /study-plans/current` | `POST/PATCH/DELETE /study-plans/current/tasks/*` | 필요 | `StudyPlanContext`, `jinro_study_tasks` | `tasks[].day`, `priority`, `completion` |
| `study check` | `GET /study-plans/current` | `PATCH /study-plans/current/tasks/:taskId` | 필요 | `StudyPlanContext` | `done` 토글 |
| `completion check` | 학생: `GET /study-plans/current`, 교사: `GET /completion-status` | 없음 | 선택 | `StudyPlanContext`, `mock.ts` | 학생/교사 shape 다름 |
| `goal setting` | `GET /goals/current`, `GET /goals/options` | `PUT /goals/current`, `DELETE /goals/current` | 선택 | `mock.ts` | `universities`, `departmentsByField`, `savedAt` |
| `counseling` | 학생: `GET /counseling/requests`, 교사: `GET /counseling/requests`, `GET /counseling/memos` | `POST /counseling/requests`, `PATCH /counseling/requests/:id/status`, `POST/PATCH/DELETE /counseling/memos/*` | 필요 | `mock.ts`, local `useState` | 학생/교사 권한 분기 |
| `notifications / alert center` | `GET /notifications`, `GET /sse/token` | `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | 필요 | `mock.ts`, `NotificationContext`, `jinro_pending_*`, `jinro_shown_*` | `meta.streamToken` 사용 가능 |
| `my page` | `GET /me` | `PATCH /me` | 불필요 | 하드코딩 | `studentProfile`, `teacherProfile` 둘 중 하나 사용 |
| `teacher student list` | `GET /students` | 없음 | 선택 | `mock.ts` | `status`, `completion`, `counselNeeded` |
| `teacher student detail` | `GET /students/:studentId`, `GET /grades/chart?studentId=...`, `GET /growth-report?studentId=...` | 상담/메모 API 연동 | 선택 | `mock.ts`, `gradeStorage.ts` | `student`, `alerts`, `recentMemos` |
| `teacher counseling memo` | `GET /counseling/memos?studentId=` | `POST/PATCH/DELETE /counseling/memos/*` | 선택 | local memo state | `subject`, `content`, `tag`, `shared` |
| `received requests` | `GET /counseling/requests` | `PATCH /counseling/requests/:id/status` | 필요 | `mock.ts` | `status: pending/in_progress/completed/canceled` |
| `completion status` | `GET /completion-status` | 없음 | 선택 | `mock.ts` | `summary`, `trend`, `lowStudents` |
| `ai chat` | 없음 | `POST /ai/chat` | 불필요 | 하드코딩 응답 | `route`, `answer`, `citations` |
| `ai career chat` | 없음 | `POST /ai/career-chat` | 불필요 | 하드코딩 응답 | `route: LLM`, `citations: []` |
| `university recommendation` | `GET /admissions`, 필요 시 `POST /rag/query` | 없음 | 불필요 | `ADMISSIONS_DATA` | 정적 목록과 RAG 질의 분리 |

## 7. 엔드포인트 카탈로그

### Auth / Me

| method | path | 설명 | auth | role | request | response |
| --- | --- | --- | --- | --- | --- | --- |
| `POST` | `/auth/student/signup` | 학생 회원가입 | N | 공개 | `name,email,password,passwordConfirm,inviteCode?` | session |
| `POST` | `/auth/teacher/signup` | 교사 회원가입 | N | 공개 | `schoolName,name,email,password,passwordConfirm,grade,classNum,subject?` | session |
| `POST` | `/auth/student/login` | 학생 로그인 | N | 공개 | `email,password` | session |
| `POST` | `/auth/teacher/login` | 교사 로그인 | N | 공개 | `email,password` | session |
| `POST` | `/auth/refresh` | 토큰 재발급 | N | 공개 | `refreshToken` | session |
| `POST` | `/auth/logout` | 로그아웃 | N | 공개 | `refreshToken` | `{ loggedOut: true }` |
| `POST` | `/auth/invite/validate` | 초대코드 확인 | N | 공개 | `inviteCode` | class summary |
| `GET` | `/me` | 현재 사용자 조회 | Y | 전역 | 없음 | user profile |
| `PATCH` | `/me` | 현재 사용자 수정 | Y | 전역 | `email?,schoolName?,track?` | `{ updated: true }` |

### Dashboard / Students / Teachers

| method | path | 설명 | auth | role | 사용 화면 |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/student/dashboard` | 학생 대시보드 | Y | student | 학생 대시보드 |
| `GET` | `/teacher/dashboard` | 교사 대시보드 | Y | teacher/admin | 교사 대시보드 |
| `GET` | `/students` | 담당 학생 목록 | Y | teacher/admin | 학생 목록 |
| `GET` | `/students/:studentId` | 학생 상세 요약 | Y | teacher/admin | 학생 상세 |
| `GET` | `/teachers/me` | 현재 교사 프로필 | Y | teacher/admin | My Page, teacher shell |
| `GET` | `/classrooms/me` | 현재 담임 반 정보 | Y | teacher/admin | teacher shell |
| `GET` | `/completion-status` | 반 완료율 대시보드 | Y | teacher/admin | 완료율 화면 |

### Grades

| method | path | 설명 | auth | role | 사용 화면 |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/grades/exams` | 중간/기말 저장 | Y | student/teacher/admin | grade input |
| `POST` | `/semester-finals` | 학기최종 저장 | Y | student/teacher/admin | grade input |
| `POST` | `/mock-exams` | 모의 저장 | Y | student/teacher/admin | grade input |
| `GET` | `/grades/chart` | 차트 조회 | Y | student/teacher/admin | grade trend |
| `GET` | `/growth-report` | 성장 리포트 조회 | Y | student/teacher/admin | growth report |

### Study Plans

| method | path | 설명 | auth | role |
| --- | --- | --- | --- | --- |
| `GET` | `/study-plans/current` | 현재 주간 계획 조회 | Y | 전역 |
| `POST` | `/study-plans/current/tasks` | 태스크 추가 | Y | 전역 |
| `PATCH` | `/study-plans/current/tasks/:taskId` | 태스크 수정/완료 체크 | Y | 전역 |
| `DELETE` | `/study-plans/current/tasks/:taskId` | 태스크 삭제 | Y | 전역 |

### Counseling

| method | path | 설명 | auth | role |
| --- | --- | --- | --- | --- |
| `GET` | `/counseling/requests` | 상담 요청 목록 | Y | 전역 |
| `POST` | `/counseling/requests` | 상담 요청 생성 | Y | student |
| `PATCH` | `/counseling/requests/:requestId/status` | 요청 상태 변경 | Y | teacher/admin |
| `GET` | `/counseling/memos` | 상담 메모 목록 | Y | 전역 |
| `POST` | `/counseling/memos` | 상담 메모 생성 | Y | teacher/admin |
| `PATCH` | `/counseling/memos/:memoId` | 상담 메모 수정 | Y | teacher/admin |
| `DELETE` | `/counseling/memos/:memoId` | 상담 메모 삭제 | Y | teacher/admin |

### Notifications / SSE

| method | path | 설명 | auth | role |
| --- | --- | --- | --- | --- |
| `GET` | `/notifications` | 알림 목록 조회 | Y | 전역 |
| `PATCH` | `/notifications/:notificationId/read` | 읽음 처리 | Y | 전역 |
| `PATCH` | `/notifications/read-all` | 전체 읽음 처리 | Y | 전역 |
| `GET` | `/sse/token` | stream token 발급 | Y | 전역 |
| `GET` | `/sse/stream` | SSE 스트림 | Y | 전역 |

### Goals / Admissions / AI

| method | path | 설명 | auth | role |
| --- | --- | --- | --- | --- |
| `GET` | `/goals/current` | 현재 목표 조회 | Y | 전역 |
| `PUT` | `/goals/current` | 목표 저장/교체 | Y | 전역 |
| `DELETE` | `/goals/current` | 목표 삭제 | Y | 전역 |
| `GET` | `/goals/options` | 대학/학과 옵션 조회 | Y | 전역 |
| `GET` | `/admissions` | 입시 결과 목록 | Y | 전역 |
| `POST` | `/ai/chat` | 일반 AI 상담 | Y | 전역 |
| `POST` | `/ai/career-chat` | AI 진로 상담 | Y | 전역 |
| `POST` | `/rag/query` | 입시 RAG 질의 | Y | 전역 |

## 8. 성적 계약

### 8.1 Exams (중간/기말)

- 입력 API: `POST /v1/grades/exams`
- 수정 API: `POST /v1/grades/exams` 동일 semester + examType 재저장
- 조회 API: 개별 raw 조회 없음, 차트는 `/v1/grades/chart?mode=exam`
- 학생/교사 차이:
  - 학생: `studentId` 생략
  - 교사: `studentId` 필수

#### request body

```json
{
  "studentId": "optional-for-teacher",
  "semester": "2026 1학기",
  "examType": "중간고사",
  "subjects": [
    {
      "name": "국어",
      "score": 91,
      "status": "상승",
      "memo": "풀이 시간 단축"
    }
  ]
}
```

#### 필드 정의

| field | type | required | rule |
| --- | --- | --- | --- |
| `semester` | string | Y | `YYYY n학기` |
| `examType` | enum | Y | `중간고사`, `기말고사` |
| `subjects[].name` | string | Y | 과목명 |
| `subjects[].score` | number | Y | `0~100` |
| `subjects[].status` | string | N | 프론트 표시용 |
| `subjects[].memo` | string | N | 메모 |

### 8.2 Semester Finals (학기최종)

- 입력 API: `POST /v1/semester-finals`
- 수정 API: 동일 semester 재저장
- 조회 API: `/v1/grades/chart?mode=final`, `/v1/growth-report`

```json
{
  "semester": "2026 1학기",
  "subjects": [
    {
      "name": "국어",
      "finalGrade": 2,
      "credit": 4,
      "applied": true
    }
  ]
}
```

| field | type | required | rule |
| --- | --- | --- | --- |
| `finalGrade` | number | Y | `1~9` |
| `credit` | number | Y | 정수 `1~8` |
| `applied` | boolean | Y | 반영 여부 |

### 8.3 Mock Exams (모의)

- 입력 API: `POST /v1/mock-exams`
- 수정 API: 동일 `semester` 재저장
- 조회 API: `/v1/grades/chart?mode=practice`

```json
{
  "semester": "2026 9월",
  "subjects": [
    {
      "name": "국어",
      "score": 92,
      "grade": 2
    }
  ]
}
```

| field | type | required | rule |
| --- | --- | --- | --- |
| `semester` | string | Y | `YYYY M월` |
| `subjects[].score` | number | N | `0~100` |
| `subjects[].grade` | number | N | `1~9` |

### 8.4 Grades Chart

- 조회 API: `GET /v1/grades/chart?mode=final|exam|practice&studentId?=...`

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "period": "2026 1학기",
        "국어": 2,
        "영어": 3
      }
    ],
    "lines": [
      {
        "dataKey": "국어",
        "label": "국어",
        "color": "#C5614A"
      }
    ],
    "hasRealData": true
  },
  "requestId": "4fd6ef4f-b78b-4d95-ad89-673718f31f4c"
}
```

### 8.5 Growth Report

- 조회 API: `GET /v1/growth-report?studentId?=...`

```json
{
  "success": true,
  "data": {
    "avgFinalGrade": 2.5,
    "bestSubject": {
      "name": "국어",
      "grade": 2
    },
    "worstSubject": {
      "name": "영어",
      "grade": 3
    },
    "latestSubjects": [
      {
        "name": "국어",
        "finalGrade": "2",
        "credit": "4"
      }
    ],
    "hasRealData": true
  },
  "requestId": "750df912-6ec5-4926-9da1-fba1f6ecb8e9"
}
```

## 9. 학습 계획 계약

- 현재 주간 계획 조회: `GET /v1/study-plans/current`
- 태스크 추가: `POST /v1/study-plans/current/tasks`
- 태스크 수정: `PATCH /v1/study-plans/current/tasks/:taskId`
- 완료 체크: `PATCH /v1/study-plans/current/tasks/:taskId` with `done`
- 삭제: `DELETE /v1/study-plans/current/tasks/:taskId`
- 완료율 조회: `GET /v1/study-plans/current` 응답 `completion`

### 조회 응답 예시

```json
{
  "success": true,
  "data": {
    "planId": "f8f5528f-cce5-4d68-a470-1828cb7646b9",
    "weekStartDate": "2026-04-06T00:00:00.000Z",
    "weekEndDate": "2026-04-12T23:59:59.999Z",
    "tasks": [
      {
        "id": "4c2ebec4-c9f2-423e-ae2a-aa43be0c07e2",
        "subject": "국어",
        "task": "비문학 3지문",
        "day": "월",
        "priority": "high",
        "done": false
      }
    ],
    "completion": {
      "percentage": 50,
      "completedCount": 2,
      "totalCount": 4
    }
  },
  "requestId": "362373f0-c926-42b0-93f5-7aafbf5b9ea2"
}
```

### StudyPlanContext 대체 방식

- 초기 진입 시 `GET /study-plans/current`
- 추가/수정/삭제 후 로컬 state patch
- 동시에 `study-plan.updated` SSE 수신 시 서버 값 재동기화 또는 부분 갱신

## 10. 상담 계약

### 상담 요청

- 생성: `POST /v1/counseling/requests`
- 목록: `GET /v1/counseling/requests`
- 상태 변경: `PATCH /v1/counseling/requests/:requestId/status`
- 받은 요청 목록: 교사에서 같은 목록 API 사용

#### 생성 예시

```json
{
  "type": "진로 고민",
  "message": "이번 학기 목표를 다시 잡고 싶어요."
}
```

```json
{
  "success": true,
  "data": {
    "id": "90cf9b4a-e9a2-4fcb-bb2b-e75205061329",
    "type": "진로 고민",
    "message": "이번 학기 목표를 다시 잡고 싶어요.",
    "date": "2026-04-12",
    "status": "pending"
  },
  "requestId": "9174fc5d-2d95-4996-9865-8f3efe7cdd38"
}
```

### 상담 메모

- 목록: `GET /v1/counseling/memos`
- 생성: `POST /v1/counseling/memos`
- 수정: `PATCH /v1/counseling/memos/:memoId`
- 삭제: `DELETE /v1/counseling/memos/:memoId`

#### 생성 예시

```json
{
  "studentId": "f730c3e4-6e85-497f-ac5e-eb595db6455c",
  "requestId": "90cf9b4a-e9a2-4fcb-bb2b-e75205061329",
  "subject": "진로 상담 메모",
  "content": "컴퓨터공학과 목표 유지, 모의 수학 보완 필요",
  "tag": "follow-up",
  "shareWithStudent": true
}
```

### 권한 차이

- 학생:
  - 요청 생성 가능
  - 자기 요청/공유 메모만 조회 가능
- 교사:
  - 담당 학생 요청 조회/상태 변경 가능
  - 담당 학생 메모 CRUD 가능

### SSE 연동 포인트

- 학생 요청 생성 시 교사: `counseling.request.created`
- 교사 상태 변경 시 학생: `counseling.request.updated`
- 교사 공유 메모 생성 시 학생: `counseling.memo.created`

### AI 확장 포인트

- `counseling_memo` 저장 후 후속 단계에서 AI 요약/초안 생성 가능
- 현재 응답 계약에는 영향 없음

## 11. 알림 계약

- 목록 조회: `GET /v1/notifications?page=1&pageSize=20&tab=all|unread|important`
- 읽음 처리: `PATCH /v1/notifications/:notificationId/read`
- 전체 읽음: `PATCH /v1/notifications/read-all`
- role별 알림: 같은 endpoint, user scope만 다름

### 목록 응답 예시

```json
{
  "success": true,
  "data": [
    {
      "id": "fce0e051-a527-46b7-b771-d8f6a2f018ab",
      "type": "info",
      "category": "상담",
      "title": "새 상담 요청이 도착했습니다",
      "body": "김학생 학생이 진로 고민 상담을 요청했습니다.",
      "time": "1시간 전",
      "read": false
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 4,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "streamToken": "<jwt>"
  },
  "requestId": "1dd60e03-c2fe-4d3c-82c8-2d72c60400b6"
}
```

### 기존 localStorage 대체

- `jinro_pending_student`, `jinro_pending_teacher` -> 서버 `Notification` + `GET /notifications`
- `jinro_shown_student`, `jinro_shown_teacher` -> 서버 상태(`READ`, `DISMISSED`) + SSE

## 12. 목표 / 입시 계약

### 목표

- 조회: `GET /v1/goals/current`
- 저장: `PUT /v1/goals/current`
- 삭제: `DELETE /v1/goals/current`
- 옵션: `GET /v1/goals/options`

#### 저장 예시

```json
{
  "university": "서울대학교",
  "department": "컴퓨터공학부",
  "field": "공학",
  "targetGrade": 2.4,
  "targetScore": 320
}
```

### 입시 정적 조회

- 조회: `GET /v1/admissions?search=&year=&type=&category=&region=&page=1&pageSize=20`
- `type` enum: `수시`, `정시`
- `category` enum: `학생부교과`, `학생부종합`, `논술`, `수능위주`, `실기/실적`

#### 응답 예시

```json
{
  "success": true,
  "data": [
    {
      "id": "6db9ff56-df54-4e9a-b5e4-e20df6988e82",
      "university": "서울대학교",
      "department": "컴퓨터공학부",
      "year": 2025,
      "type": "수시",
      "category": "학생부종합",
      "cutGrade": "2.1",
      "seats": 12,
      "source": "대교협",
      "updated": "2026-04-10"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "requestId": "6f7b18d6-877e-44c4-bb27-a2cbec5f2649"
}
```

### university recommendation 분기

- 기본 추천/필터형 목록: `/v1/admissions`
- 근거 포함 질의형 추천: `/v1/rag/query`

## 13. AI / RAG 계약

### `POST /v1/ai/chat`

```json
{
  "conversationId": "optional",
  "studentId": "optional-for-teacher",
  "message": "성적과 생활기록부를 같이 봤을 때 지원 방향이 맞을까요?"
}
```

```json
{
  "success": true,
  "data": {
    "conversationId": "f60d90b8-5926-4d57-a459-34bdf2a73ef3",
    "route": "HYBRID",
    "answer": "stub 응답...",
    "citations": [
      {
        "documentId": "c20ec586-6fb4-46ba-b202-b6228c5edb88",
        "title": "2025 수시 모집요강",
        "locator": "p.12",
        "sourceName": "서울대학교 2025 모집요강",
        "excerpt": "컴퓨터공학부 학생부종합..."
      }
    ],
    "meta": {
      "provider": "stub",
      "model": "stub-chat-model",
      "isStub": true
    }
  },
  "requestId": "5029b84b-c7fc-42fd-b863-fbeebed982c1"
}
```

### `POST /v1/ai/career-chat`

- 진로 상담 전용
- `route`는 현재 항상 `LLM`

### `POST /v1/rag/query`

- 입시 근거 검색 전용
- citation 중심 응답

## 14. `GET /v1/me` 응답 예시

```json
{
  "success": true,
  "data": {
    "id": "4d3f4d56-6f62-4a80-8be6-34b8d5dcefa1",
    "email": "student.seed@jinro.local",
    "role": "student",
    "unreadAlertCount": 3,
    "streamToken": "<jwt>",
    "studentProfile": {
      "id": "f730c3e4-6e85-497f-ac5e-eb595db6455c",
      "name": "김학생",
      "schoolName": "진로나침반고",
      "grade": "2학년",
      "classLabel": "2반",
      "track": "인문계열",
      "onboardingCompleted": true,
      "goal": {
        "university": "서울대학교",
        "department": "컴퓨터공학부",
        "targetGrade": 2.4,
        "targetScore": 320
      }
    },
    "teacherProfile": null
  },
  "requestId": "d4117c87-a7db-47f3-abaf-b5af957235cc"
}
```

## 15. student / teacher dashboard 예시

### Student Dashboard

```json
{
  "success": true,
  "data": {
    "greetingName": "김학생",
    "todayLabel": "2026년 4월 12일 토요일",
    "stats": {
      "averageGrade": 2.5,
      "weeklyCompletion": 50,
      "goalProgress": 75,
      "unreadAlerts": 3
    },
    "todayTasks": [
      {
        "id": "4c2ebec4-c9f2-423e-ae2a-aa43be0c07e2",
        "subject": "국어",
        "task": "비문학 3지문",
        "day": "월",
        "priority": "high",
        "done": false
      }
    ],
    "recentAlerts": [],
    "goalSummary": {
      "university": "서울대학교",
      "department": "컴퓨터공학부",
      "targetGrade": 2.4,
      "targetScore": 320
    }
  },
  "requestId": "49e93cc2-33b8-432a-bd18-3b6fa8326190"
}
```

### Teacher Dashboard

```json
{
  "success": true,
  "data": {
    "classroom": {
      "schoolName": "진로나침반고",
      "grade": "2학년",
      "className": "2반",
      "inviteCode": "JN-2026-2A-SEED",
      "studentCount": 1
    },
    "stats": {
      "totalStudents": 1,
      "counselNeeded": 1,
      "noGoal": 0,
      "lowCompletion": 0
    },
    "students": [
      {
        "id": "f730c3e4-6e85-497f-ac5e-eb595db6455c",
        "name": "김학생",
        "grade": "2학년",
        "track": "인문계열",
        "gpa": 2.5,
        "goal": "서울대학교 컴퓨터공학부",
        "status": "warning",
        "completion": 50,
        "counselNeeded": true
      }
    ],
    "counselingRequests": []
  },
  "requestId": "b246cbf1-d6b5-4f3b-b78d-efc47eddb819"
}
```

## 16. 프론트 연동 체크리스트

| API | 필드명 즉시 사용 | adapter 필요 | 대체 대상 | 초기 렌더 필수 | 낙관적 업데이트 | role 분기 |
| --- | --- | --- | --- | --- | --- | --- |
| `/v1/student/dashboard` | 예 | 아니오 | `mock.ts` | 예 | 아니오 | student |
| `/v1/teacher/dashboard` | 예 | 아니오 | `mock.ts` | 예 | 아니오 | teacher |
| `/v1/grades/chart` | 예 | 아니오 | `mock.ts`, `gradeStorage` | 예 | 아니오 | student/teacher |
| `/v1/growth-report` | 예 | 아니오 | `gradeStorage` | 예 | 아니오 | student/teacher |
| `/v1/grades/exams` | 예 | 아니오 | `jinro_grade_data` | 아니오 | 가능 | student/teacher |
| `/v1/semester-finals` | 예 | 아니오 | `jinro_grade_data` | 아니오 | 가능 | student/teacher |
| `/v1/mock-exams` | 예 | 아니오 | `jinro_grade_data` | 아니오 | 가능 | student/teacher |
| `/v1/study-plans/current*` | 예 | 아니오 | `StudyPlanContext`, `jinro_study_tasks` | 예 | 예 | student/teacher |
| `/v1/notifications*` | 예 | 아니오 | `mock.ts`, `NotificationContext`, `jinro_pending_*` | 예 | 예 | 전역 |
| `/v1/counseling/requests*` | 예 | 아니오 | `mock.ts` | 예 | 부분 | student/teacher |
| `/v1/counseling/memos*` | 예 | 아니오 | local memo state | 예 | 부분 | teacher/student |
| `/v1/goals/*` | 예 | 아니오 | `mock.ts` | 예 | 예 | student/teacher |
| `/v1/admissions` | 예 | 아니오 | `ADMISSIONS_DATA` | 예 | 아니오 | 전역 |
| `/v1/ai/chat`, `/v1/ai/career-chat`, `/v1/rag/query` | 예 | 아니오 | 하드코딩 응답 | 아니오 | 아니오 | 전역 |

