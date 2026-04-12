# AWS Staging Deploy Checklist

## Completed in repository

- Staging task definition template added: `backend/deploy/ecs/task-definition.staging.json`
- GitHub Actions CD workflow added: `.github/workflows/cd-staging.yml`
- Staging env variable reference updated: `backend/.env.example`
- Staging env mapping document updated: `backend/docs/aws-staging-env.md`
- Deploy runbook added: `backend/docs/deploy-runbook.md`
- CD path fixes `prisma migrate deploy` to run before ECS service rollout

## Required AWS resources before first deploy

| Resource | Required state |
| --- | --- |
| ECR repository | Exists: `jinro/backend` |
| RDS PostgreSQL | Exists and reachable from ECS private subnets |
| ECS cluster | Must exist |
| ECS service | Must exist |
| ECS task execution role | Must exist |
| ECS task role | Must exist |
| ALB | Must exist |
| Target group | Must exist and use `/health` |
| Listener rule | Must route staging hostname to target group |
| Private subnets | Must exist for ECS tasks |
| ECS task security group | Must exist |
| RDS security group | Must allow inbound only from ECS task SG |
| CloudWatch log group | Must exist |
| Secrets Manager secrets | Must exist and be represented by ARNs in GitHub Variables |
| GitHub OIDC role | Must exist and trust GitHub Actions |

## Manual creation order

1. VPC and private/public subnets
2. Security groups
3. ALB and target group
4. RDS and DB security group rule
5. ECS cluster
6. CloudWatch log group
7. IAM execution role and task role
8. Secrets Manager secrets
9. ECS service placeholder deployment
10. GitHub Variables for staging CD
11. Workflow dispatch or develop branch push

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
- `STAGING_AI_API_KEY_SECRET_ARN`

## Health check baseline

- Container health command: local `/health`
- ALB target health path: `/health`
- Success status: `200`
- Deployment is not considered healthy until ALB and ECS both stabilize

## Prisma migration timing

- Fixed point: CD workflow runs `prisma migrate deploy` as a one-off ECS Fargate task
- Order is strict:
  1. build image
  2. push image
  3. register task definition
  4. run `prisma migrate deploy`
  5. only if migration exits `0`, update ECS service

## CORS staging hook

- `STAGING_CORS_ORIGIN` must be the exact Amplify staging origin
- The workflow writes this value into the ECS task definition before deploy

## Verification note

- Actual AWS secret list could not be enumerated with the current IAM principal because `secretsmanager:ListSecrets` is denied.
- ECR existence was verified for `jinro/backend`.
