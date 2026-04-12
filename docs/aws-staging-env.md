# AWS Staging Environment Variables

## Canonical source

- `backend/.env.example` is the canonical key set for the container.
- This document maps the same keys to staging injection locations.
- The CD workflow consumes GitHub Variables that point to ECS values and secret ARNs.

## Container environment keys

| Key | Staging example | Injection |
| --- | --- | --- |
| `PORT` | `4000` | ECS env |
| `NODE_ENV` | `production` | ECS env |
| `APP_BASE_URL` | `https://api-staging.example.com` | ECS env |
| `LOG_LEVEL` | `info` | ECS env |
| `CORS_ORIGIN` | `https://staging.example.amplifyapp.com` | ECS env |
| `DATABASE_URL` | secret value | Secrets Manager ARN |
| `JWT_ACCESS_SECRET` | secret value | Secrets Manager ARN |
| `JWT_REFRESH_SECRET` | secret value | Secrets Manager ARN |
| `JWT_STREAM_SECRET` | secret value | Secrets Manager ARN |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | ECS env |
| `JWT_REFRESH_EXPIRES_IN` | `14d` | ECS env |
| `JWT_STREAM_EXPIRES_IN` | `60s` | ECS env |
| `REFRESH_TOKEN_COOKIE_NAME` | `jinro_refresh_token` | ECS env |
| `ACCESS_TOKEN_HEADER_NAME` | `authorization` | ECS env |
| `RATE_LIMIT_WINDOW_MS` | `900000` | ECS env |
| `RATE_LIMIT_MAX` | `200` | ECS env |
| `AUTH_RATE_LIMIT_MAX` | `20` | ECS env |
| `SSE_HEARTBEAT_INTERVAL_MS` | `15000` | ECS env |
| `SSE_RETRY_INTERVAL_MS` | `3000` | ECS env |
| `AI_PROVIDER` | `stub` | ECS env |
| `AI_API_KEY` | optional secret value | Secrets Manager ARN |
| `AI_MODEL_DEFAULT` | `stub-chat-model` | ECS env |
| `AI_EMBEDDING_MODEL` | `stub-embedding-model` | ECS env |
| `AI_REQUEST_TIMEOUT_MS` | `30000` | ECS env |
| `AWS_REGION` | `ap-northeast-2` | ECS env |
| `AWS_S3_BUCKET` | optional | ECS env |
| `AWS_SECRETS_PREFIX` | `/jinro-nachimban/staging/backend` | ECS env |

## GitHub Variables consumed by CD

| Variable | Purpose |
| --- | --- |
| `STAGING_AWS_OIDC_ROLE_ARN` | GitHub OIDC assume role |
| `STAGING_ECS_CLUSTER` | ECS cluster name |
| `STAGING_ECS_SERVICE` | ECS service name |
| `STAGING_ECS_TASK_FAMILY` | ECS task definition family |
| `STAGING_ECS_TASK_EXECUTION_ROLE_ARN` | ECS execution role ARN |
| `STAGING_ECS_TASK_ROLE_ARN` | ECS task role ARN |
| `STAGING_ECS_SUBNET_IDS` | Comma-separated private subnet IDs |
| `STAGING_ECS_SECURITY_GROUP_IDS` | Comma-separated task security group IDs |
| `STAGING_ECS_ASSIGN_PUBLIC_IP` | `DISABLED` recommended |
| `STAGING_ECS_LOG_GROUP` | CloudWatch log group |
| `STAGING_APP_BASE_URL` | ALB / API base URL |
| `STAGING_CORS_ORIGIN` | Amplify staging origin |
| `STAGING_AWS_SECRETS_PREFIX` | Secret naming prefix |
| `STAGING_DATABASE_URL_SECRET_ARN` | DATABASE_URL secret ARN |
| `STAGING_JWT_ACCESS_SECRET_ARN` | JWT access secret ARN |
| `STAGING_JWT_REFRESH_SECRET_ARN` | JWT refresh secret ARN |
| `STAGING_JWT_STREAM_SECRET_ARN` | JWT stream secret ARN |
| `STAGING_AI_API_KEY_SECRET_ARN` | Optional AI API key secret ARN |

## Required Secrets Manager semantic keys

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_STREAM_SECRET`
- `AI_API_KEY` optional

## Verification note

- This document is aligned to `.env.example` and the CD workflow variable names.
- Actual secret inventory in AWS could not be enumerated from the current IAM principal because `secretsmanager:ListSecrets` is denied.
