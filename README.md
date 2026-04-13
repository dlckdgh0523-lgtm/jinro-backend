# 진로나침반 Backend

학생 맞춤형 진로 탐색, 학습 관리, 입시 정보 분석을 지원하는 AI 기반 진로·진학 플랫폼의 백엔드 서버입니다.

진로나침반 백엔드는 학생과 교사를 위한 인증, 성적 관리, 상담 요청, 목표 설정, 학습 계획, 알림, AI 상담, 입시 데이터 조회 기능을 제공합니다.  
실서비스 운영을 염두에 두고 인증·권한·상태 관리와 API 구조를 분리하여 설계했습니다.

---

## 프로젝트 소개

진로나침반은 학생이 자신의 성적 변화와 목표를 데이터 기반으로 확인하고, 교사가 학생의 학습·상담·진로 상태를 체계적으로 관리할 수 있도록 돕는 서비스입니다.

백엔드는 아래와 같은 핵심 역할을 담당합니다.

- 학생 / 교사 계정 인증 및 권한 관리
- 학교 / 학급 / 초대코드 기반 연결 구조
- 성적 입력 및 조회 API
- 상담 요청 / 상담 메모 / 상태 관리
- 목표 설정 및 학습 계획 관리
- 알림 API 및 SSE 기반 실시간 알림
- AI 상담 및 RAG 연동을 위한 백엔드 엔드포인트
- 문의/건의사항 및 계정 비활성화(회원탈퇴) 처리

---

## 주요 기능

### 1. 인증 / 사용자 관리
- 학생 / 교사 회원가입 및 로그인
- Google OAuth 로그인 지원
- JWT 기반 세션 처리
- refresh token 관리
- `/v1/me` 기반 사용자 정보 조회
- 계정 비활성화(회원탈퇴) 처리

### 2. 학생-교사 연결
- 교사 회원가입 시 학교, 학년, 반 기반 학급 생성
- 학급 초대코드 발급 및 검증
- 학생은 초대코드 없이 가입 가능
- 이후 초대코드 입력을 통해 교사와 연결 가능

### 3. 성적 관리
- 중간고사 / 기말고사 / 학기 성적 / 모의고사 입력
- 학생 본인 성적 조회
- 교사용 학생 성적 조회
- 차트 렌더링을 위한 성적 집계 API 제공

### 4. 상담 / 메모
- 학생 상담 요청 생성
- 교사의 상담 요청 수락 / 거절 / 진행 / 완료 처리
- 상담 메모 작성
- 교사용 비공개 메모 / 학생 공개 메모 구분

### 5. 목표 / 학습 계획
- 목표 대학 / 학과 설정
- 주간 학습 계획 및 학습 완료 체크
- 학생 진행 상황에 따른 관리 기능

### 6. 알림 / 실시간
- 알림 목록 조회 및 읽음 처리
- SSE(Server-Sent Events) 기반 실시간 이벤트 전달

### 7. AI / RAG
- AI 상담 엔드포인트 제공
- RAG 관련 스키마 및 API 구조 포함
- 향후 실제 입시 데이터 수집 및 임베딩/검색 구조로 확장 가능하도록 설계

### 8. 문의 / 운영
- 문의/건의사항 등록 및 조회
- 운영 확장을 고려한 구조 반영

---
## 배포 및 운영 전략

진로나침반은 프론트엔드와 백엔드를 분리된 저장소로 운영하며, 각 영역을 독립적으로 배포합니다.  
백엔드는 API 서버 역할을 담당하며 인증, 성적 관리, 상담, 알림, AI 엔드포인트, 목표/학습 계획 등의 핵심 비즈니스 로직을 처리합니다.

### 배포 환경
- Backend: Render
- Domain: 백엔드 전용 API 도메인 사용
- Database: PostgreSQL (Prisma 기반)
- Runtime: Node.js + Express

### 배포 방식
- GitHub 저장소와 배포 플랫폼을 연동하여 지정 브랜치 기준으로 배포합니다.
- 환경변수는 배포 플랫폼에서 별도로 관리하며, 민감한 값(API Key, JWT Secret, OAuth Secret 등)은 저장소에 포함하지 않습니다.
- Prisma migration은 배포 시점에 반영될 수 있도록 운영합니다.

### 운영 전략
- 인증/권한/상태값은 백엔드에서 일관되게 관리합니다.
- 학생/교사 역할 분리, 상담 상태, 알림 이벤트, 성적 데이터 저장 등 핵심 상태는 DB 기준으로 처리합니다.
- 프론트가 로컬 상태에 의존하지 않도록 실제 API 중심 구조로 전환하는 방향으로 운영합니다.

### CI/CD 전략
- 프론트엔드와 백엔드는 별도 저장소이므로 각각 독립적으로 배포됩니다.
- 백엔드는 코드 반영 후 배포 환경에서 최신 커밋 기준으로 재배포합니다.
- 변경 시 우선순위는 다음과 같습니다.
  1. 스키마 / migration 정합성 확인
  2. API 동작 확인
  3. 인증 및 권한 흐름 확인
  4. 프론트와의 연동 검증

### 배포 후 주요 점검 항목
- `/health` 또는 서버 상태 확인 엔드포인트 정상 응답
- 학생 / 교사 로그인 및 회원가입
- Google OAuth callback 동작
- 성적 입력 후 DB 반영 여부
- 상담 요청 / 수락 / 거절 상태 반영 여부
- SSE 알림 연결 여부
- AI 엔드포인트 정상 응답 여부
## 기술 스택

- Node.js 20
- TypeScript
- Express
- Prisma
- PostgreSQL
- JWT
- Google OAuth (`google-auth-library`)
- SSE
- Zod
- Pino
- Vitest

---

## 폴더 구조

```bash
.
├─ prisma/              # Prisma schema, migration, seed
├─ src/
│  ├─ config/           # 환경변수, 설정
│  ├─ modules/          # 도메인별 모듈(auth, counseling, grades, ai 등)
│  ├─ common/           # 공통 유틸, 에러 처리, HTTP 응답
│  └─ server.ts         # 서버 진입점
├─ tests/               # 테스트 코드
├─ scripts/             # 검증 및 실행 보조 스크립트
├─ docs/                # 운영 및 배포 문서
├─ Dockerfile
└─ docker-compose.dev.yml


실행 방법
1. 패키지 설치
npm install
2. 환경변수 설정

루트에 .env 파일을 생성하고 .env.example을 참고하여 값을 채웁니다.

cp .env.example .env
3. Prisma generate / migrate
npm run prisma:generate
npm run prisma:migrate:dev
4. 개발 서버 실행
npm run dev
5. 프로덕션 빌드
npm run build
npm run start
주요 스크립트
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run prisma:generate
npm run prisma:migrate:dev
npm run prisma:migrate:deploy
npm run seed
환경변수 예시
PORT=4000
NODE_ENV=production
APP_BASE_URL=
CORS_ORIGIN=
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_STREAM_SECRET=
AI_PROVIDER=
AI_API_KEY=
AI_MODEL_DEFAULT=
AI_EMBEDDING_MODEL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
배포 정보
Backend Repository
https://github.com/dlckdgh0523-lgtm/jinro-backend
Frontend Repository
https://github.com/dlckdgh0523-lgtm/jinro-front
Live URL
https://www.jinro.it.kr
향후 개선 방향
실제 입시 데이터 수집 파이프라인 고도화
RAG 검색 품질 향상
추천 로직 정교화
관리자 운영 기능 확장
실시간 기능 안정성 강화
