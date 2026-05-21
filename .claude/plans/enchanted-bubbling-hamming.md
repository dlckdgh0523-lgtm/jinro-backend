# Google Auth 백엔드 수정 플랜

## Context

Google OAuth가 작동하지 않습니다. 백엔드에 치명적 버그 다수 존재:
1. `state` 파라미터를 생성하지 않지만 callback에서 required로 검증
2. Redirect URI가 initiation과 callback 간 불일치 가능
3. Callback이 GET 방식이라 code가 URL에 노출됨
4. state 기반 CSRF 보호 없음

프론트엔드는 UI 목업 상태(별도 작업 예정)이므로, 백엔드 API를 올바르게 수정하여 나중에 프론트엔드 연동 시 바로 동작하도록 합니다.

## 수정 사항

### 1. `src/modules/auth.validator.ts`
- `googleCallbackSchema`를 body 검증용으로 변경: `{ code: string, redirectUri?: string }`
- `state` 필드 제거 (CSRF는 프론트엔드에서 localStorage 기반으로 처리)

### 2. `src/modules/auth.ts`
- `/auth/google` (GET 유지): state를 생성하여 응답에 포함 → `{ authUrl, state }`
- `/auth/google/callback`: **GET → POST로 변경**
  - Body에서 `code`, `redirectUri` 수신
  - `validate(googleCallbackSchema)` (body 기본)
  - redirect URI는 body의 `redirectUri` 사용, 없으면 `env.GOOGLE_CALLBACK_URL` 폴백

### 3. `src/modules/auth.service.ts`  
- `handleGoogleCallback` 시그니처 정리: `{ code, redirectUri }` 만 받음 (state 제거)

## 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `src/modules/auth.validator.ts` | googleCallbackSchema → `{ code, redirectUri? }` |
| `src/modules/auth.ts` | `/auth/google`에 state 추가, callback을 POST로 변경 |
| `src/modules/auth.service.ts` | handleGoogleCallback에서 state 관련 코드 제거 |

## 검증

1. `npm run typecheck` — 빌드 에러 없음
2. `npm run dev` — 서버 기동 확인
3. `GET /v1/auth/google` 호출 → `{ authUrl, state }` 반환 확인
4. `POST /v1/auth/google/callback` with `{ code: "test" }` → 적절한 에러 응답 (Google 토큰 교환 실패이지만 500이 아닌 명확한 에러)
