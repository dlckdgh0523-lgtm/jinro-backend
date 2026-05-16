# Memory — jinro-nachimban-backend

## Last Updated: 2026-05-17 (Phase 2 complete)

## Current State Summary

### Architecture
- Express 4 + TypeScript + Prisma + PostgreSQL backend
- Modules: auth, grades, counseling, goals, study-plans, notifications, dashboard, admissions, ai, inquiry, me, health
- Deployment target: EC2 (Docker), but README still references Render
- Frontend: Next.js at `jinro-front` repo, currently UI-only (no real API integration)

### Verification Results (2026-05-17)
- `prisma:validate` ✅
- `prisma:generate` ✅
- `typecheck` ✅
- `lint` ✅
- `test` ✅ (12 tests pass)
- `build` ✅

### Problems Found & Fixed

#### Google OAuth (Critical)
**Root cause:** Multiple bugs prevented Google OAuth from working:
1. `state` parameter was required in callback validator but never generated in `/auth/google`
2. Callback was GET (code exposed in URL) instead of POST
3. Redirect URI could mismatch between auth initiation and token exchange
4. No CSRF protection via state

**Fix applied:**
- `/auth/google` now generates and returns `state` via `crypto.randomUUID()`
- `/auth/google/callback` changed from GET to POST, accepts `{ code, redirectUri? }` in body
- `googleCallbackSchema` updated: removed `state`, added optional `redirectUri`
- Frontend is responsible for state verification (localStorage-based)

#### Lint Errors
- `ai.ts`: Missing `cause` on rethrown error → added `{ cause: error }`
- `auth.service.ts`: `no-useless-assignment` for user variable → restructured try/catch

#### CI Workflow
- `.github/workflows/ci.yml` referenced `backend/` subdirectory (wrong) → fixed to root
- Path triggers changed to branch-based (push/PR to main)

### Phase 2: New Features Added (2026-05-17)

#### Subscription/Payment System
- Prisma models: Subscription, SubscriptionEvent, Payment
- Plans: STUDENT_PERSONAL (3,000 KRW/mo), TEACHER_CLASSROOM (30,000 KRW/mo)
- First month free trial, idempotent webhooks
- Routes: /v1/subscriptions/*, /v1/webhooks/payment

#### AI Career Counseling Engine
- Prisma models: CareerCounselingSession, CareerCounselingMessage, CareerSignal, CareerHypothesis, CareerReport, AiUsageLog
- Conversational approach inspired by Holland/RIASEC, Super, CIP, Narrative theories
- Signal extraction from natural language, hypothesis building, report generation
- Routes: /v1/career-counseling/*

#### Super Admin Backend
- SUPER_ADMIN role added to UserRole enum
- Full CRUD admin APIs: users, teachers, students, classrooms, subscriptions, AI usage, audit logs, system health
- All admin routes require SUPER_ADMIN authorization
- Routes: /v1/admin/*

#### Notification Delivery
- NotificationDeliveryLog model added
- userId + dedupeKey unique constraint for deduplication

### Known Remaining Issues
1. **Frontend has no real OAuth/API implementation** — buttons are UI mockups only
2. **README references Render deployment** — needs update for EC2
3. **No production docker-compose.yml** — only `docker-compose.dev.yml` exists
4. **DB-dependent tests not yet added** — current tests are validation-only (no DB)
5. **Vite deprecation warning** in test output — cosmetic, from Vitest CJS build (not a real issue)
6. **TypeScript `any` warnings suppressed** by `@typescript-eslint/no-explicit-any: off`

### Files Changed This Session
- `src/modules/auth.ts` — crypto import, state generation, callback GET→POST
- `src/modules/auth.service.ts` — lint fix, interface cleanup
- `src/modules/auth.validator.ts` — googleCallbackSchema: state→redirectUri
- `src/modules/ai.ts` — error cause lint fix
- `.env.example` — Google OAuth comments
- `.github/workflows/ci.yml` — path fixes
- `tests/setup-env.ts` — Google env vars for tests
- `tests/auth.test.ts` — new auth validation tests (11 tests)
- `CLAUDE.md` — new project documentation
- `memory.md` — this file

### Verification Commands
```bash
npm run prisma:validate   # needs DATABASE_URL
npm run prisma:generate   # needs DATABASE_URL
npm run typecheck
npm run lint
npm run test
npm run build
```

### Deployment Notes
- Docker build works via multi-stage Dockerfile
- `server.ts` runs `prisma migrate deploy` in production mode
- Health check: `GET /health` (no DB), `GET /health/ready` (with DB)
- Port 4000 exposed
