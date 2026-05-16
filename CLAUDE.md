# CLAUDE.md — jinro-nachimban-backend

## Project Overview

Korean high school career guidance platform backend (진로나침반).
Provides auth, grades, counseling, study plans, goals, notifications, AI chat, admissions data APIs.

## Tech Stack

- Node.js 20 / TypeScript / Express 4
- Prisma ORM + PostgreSQL
- JWT auth (access/refresh/stream tokens)
- Google OAuth via `google-auth-library`
- Zod validation, Pino logging
- Vitest for testing

## Key Commands

```bash
npm run dev              # tsx watch dev server
npm run build            # prisma generate + tsc
npm run start            # node dist/server.js
npm run typecheck        # tsc --noEmit
npm run lint             # eslint --max-warnings=0
npm run test             # vitest run
npm run prisma:generate  # generate Prisma client
npm run prisma:validate  # validate schema
npm run prisma:migrate:dev    # create migration
npm run prisma:migrate:deploy # apply migrations
```

## Verification Checklist

Before committing, all must pass:
1. `npm run prisma:validate`
2. `npm run prisma:generate`
3. `npm run typecheck`
4. `npm run lint`
5. `npm run test`
6. `npm run build`

## Architecture

- `src/config/env.ts` — Zod-validated env vars
- `src/app.ts` — Express app factory
- `src/routes.ts` — route registration
- `src/server.ts` — entry point with migrations + graceful shutdown
- `src/modules/{name}.ts` — route handlers
- `src/modules/{name}.service.ts` — business logic
- `src/modules/{name}.repository.ts` — Prisma queries
- `src/modules/{name}.validator.ts` — Zod schemas
- `src/infra/` — security (JWT/bcrypt), Prisma client, audit, realtime (SSE)
- `src/common/` — HTTP utilities, domain helpers

## Google OAuth Flow

1. Frontend calls `GET /v1/auth/google` → receives `{ authUrl, state }`
2. Frontend stores `state` in localStorage, redirects to `authUrl`
3. Google redirects to frontend `GOOGLE_CALLBACK_URL` with `?code=...&state=...`
4. Frontend verifies state, then POSTs `{ code, redirectUri }` to `/v1/auth/google/callback`
5. Backend exchanges code → creates/finds user → returns session tokens

## Environment

- `DATABASE_URL` must be set for Prisma commands
- `GOOGLE_CALLBACK_URL` is the **frontend** callback URL (where Google redirects the user)
- `CORS_ORIGIN` is comma-separated list of allowed origins
- JWT secrets must be 32+ chars

## Deployment

Target: EC2 with Docker. See `Dockerfile` and `docker-compose.dev.yml`.
Production requires:
- PostgreSQL accessible from EC2
- All env vars set (see `.env.example`)
- `prisma migrate deploy` before or during startup (handled in `server.ts` for production)

## Testing

- Tests use supertest against the Express app directly
- `tests/setup-env.ts` provides test env vars (no DB connection needed for validation tests)
- DB-dependent tests need a running PostgreSQL instance
