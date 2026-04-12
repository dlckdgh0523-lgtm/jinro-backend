# Backend Staging Deploy Runbook

## Scope

This runbook covers backend staging deploys for:

- Docker image build
- ECR push
- ECS task definition registration
- one-off `prisma migrate deploy`
- ECS service rollout
- ALB health verification

Before a real staging trigger, fill every placeholder listed in `backend/docs/staging-resource-map.md` and run the repository checks below.

## Required GitHub Variables

- `STAGING_AWS_OIDC_ROLE_ARN`
- `STAGING_ECS_CLUSTER`
- `STAGING_ECS_SERVICE`
- `STAGING_ECS_TASK_FAMILY`
- `STAGING_ECS_TASK_EXECUTION_ROLE_ARN`
- `STAGING_ECS_TASK_ROLE_ARN`
- `STAGING_ECS_SUBNET_IDS`
- `STAGING_ECS_SECURITY_GROUP_IDS`
- `STAGING_ECS_ASSIGN_PUBLIC_IP`
- `STAGING_ECS_LOG_GROUP`
- `STAGING_APP_BASE_URL`
- `STAGING_CORS_ORIGIN`
- `STAGING_AWS_SECRETS_PREFIX`
- `STAGING_DATABASE_URL_SECRET_ARN`
- `STAGING_JWT_ACCESS_SECRET_ARN`
- `STAGING_JWT_REFRESH_SECRET_ARN`
- `STAGING_JWT_STREAM_SECRET_ARN`
- `STAGING_AI_API_KEY_SECRET_ARN` optional

## Required AWS resources

- ECR repository `jinro/backend`
- ECS cluster and service
- ECS task execution role and task role
- ALB + target group + listener rule
- CloudWatch log group
- RDS PostgreSQL
- Secrets Manager secrets for runtime values

## First-time manual AWS creation order

1. Create VPC with at least two private subnets for ECS and two public subnets for ALB.
2. Create ALB security group allowing `443` from internet and egress to ECS task SG.
3. Create ECS task security group allowing inbound only from ALB SG on `4000`.
4. Create RDS security group allowing inbound only from ECS task SG on `5432`.
5. Create ALB, HTTPS listener, target group, and health check path `/health`.
6. Create RDS PostgreSQL in private subnets with public access disabled.
7. Create CloudWatch log group for backend tasks.
8. Create ECS cluster.
9. Create IAM execution role with ECR pull, CloudWatch logs, Secrets Manager read, SSM read.
10. Create IAM task role with minimum runtime permissions only.
11. Create Secrets Manager secrets and record their ARNs.
12. Create ECS service using the staging task family and attach it to the target group.
13. Add all required GitHub Variables.
14. Run `workflow_dispatch` for `.github/workflows/cd-staging.yml`.

## Deploy sequence

1. Trigger `backend-cd-staging`.
2. Workflow assumes `STAGING_AWS_OIDC_ROLE_ARN`.
3. Workflow builds backend image from `backend/Dockerfile`.
4. Workflow tags image as `staging-<git sha>`.
5. Workflow pushes image to `022038146145.dkr.ecr.ap-northeast-2.amazonaws.com/jinro/backend`.
6. Workflow renders `backend/deploy/ecs/task-definition.staging.json`.
7. Workflow registers the new task definition.
8. Workflow runs `prisma migrate deploy` as a one-off Fargate task using the same image and secrets.
9. Workflow aborts immediately if the migration task exits non-zero.
10. Workflow updates the ECS service to the new task definition.
11. Workflow waits for `services-stable`.
12. Workflow calls `${STAGING_APP_BASE_URL}/health`.

## Rollback

### Application rollback

1. Identify the previous healthy task definition revision.
2. Update ECS service back to that revision.
3. Wait for `services-stable`.
4. Re-check ALB `/health`.

### Database rollback

- Do not auto-rollback schema changes.
- If a migration is non-reversible, create a forward fix migration instead of forcing down migration in staging or production.

## Manual preflight before trigger

- `npm run verify:staging-config`
- `npm run verify:taskdef`
- `backend/.env.example` matches the intended staging key set.
- All GitHub Variables listed above are present.
- All referenced secret ARNs resolve to existing Secrets Manager entries.
- RDS is reachable from ECS subnets and SGs.
- ALB target group health check path is `/health`.
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

## Not completed by this repository change

- Creation of ECS, ALB, IAM, VPC, or RDS resources
- Real secret creation in Secrets Manager
- Redis-based SSE fan-out
