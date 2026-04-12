# Backend Render + Supabase Cutover Runbook

## Scope

This runbook covers the fastest safe cutover path for the current backend:

- Supabase Postgres as the database
- Render Web Service as the Node runtime
- current Express + Prisma + JWT + SSE architecture unchanged

Do not move this backend into Supabase Edge Functions today.

## Platform choice

- Render Web Service
- single instance only
- health check path `/health`
- pre-deploy migration `npm run prisma:migrate:deploy`

## Required Supabase inputs

- Supabase session pooler connection string on port `5432`
- custom Prisma DB user
- schema privileges for `app`, `rag`, `audit`
- optional: disable Data API if Prisma is the only access path

## Required Render inputs

- Root Directory: `backend`
- Build Command: `npm ci && npm run prisma:generate && npm run build`
- Pre-Deploy Command: `npm run prisma:migrate:deploy`
- Start Command: `npm run start`
- Health Check Path: `/health`
- Instance count: `1`

## Required environment variable keys

- `DATABASE_URL`
- `APP_BASE_URL`
- `CORS_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_STREAM_SECRET`
- `NODE_ENV`
- `LOG_LEVEL`
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

## Cutover sequence

1. Create Supabase project.
2. Create Prisma DB user and grant privileges on `app`, `rag`, `audit`.
3. Copy the Supabase session pooler connection string ending with `5432`.
4. Set all Render environment variables without committing any `.env` file.
5. Deploy Render Web Service using `render.yaml` or equivalent dashboard settings.
6. Let Render run `npm run prisma:migrate:deploy` before the new release starts.
7. Run `npm run seed` one time only if demo seed data is required.
8. Run the smoke tests below against the new public backend URL.

## Manual preflight before trigger

- `backend/.env.example` matches the intended Render + Supabase key set.
- Render service is configured with root directory `backend`.
- Render service instance count is `1`.
- Supabase connection string uses session pooler port `5432`.
- The connection string includes `schema=app`.
- No `.env` file or real secret is committed.
- Current backend CI is green.

## Manual post-deploy checks

- `GET /health`
- `POST /v1/auth/student/login`
- `GET /v1/me`
- `GET /v1/student/dashboard`
- `GET /v1/teacher/dashboard`
- `GET /v1/grades/chart?mode=final`
- `GET /v1/study-plans/current`
- `GET /v1/notifications`
- `GET /v1/admissions`

## Do not do today

- Do not move auth to Supabase Auth.
- Do not move the API to Edge Functions.
- Do not scale above one instance while SSE is still in-memory.
- Do not switch Prisma to the transaction pooler on `6543` unless a separate incident forces it.
