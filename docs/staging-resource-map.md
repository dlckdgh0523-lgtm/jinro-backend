# Staging Resource Map

This document lists the real values that must be entered by a person before a staging deploy. Do not store secret values here. Use placeholders and record only the input location.

## AWS Console values to create or copy manually

| Item | Expected value format | Entered in | Notes |
| --- | --- | --- | --- |
| ECS cluster name | `jinro-backend-staging-cluster` | ECS Console > Clusters | Must match GitHub Variable `STAGING_ECS_CLUSTER` |
| ECS service name | `jinro-backend-staging-service` | ECS Console > Service create/update | Must match GitHub Variable `STAGING_ECS_SERVICE` |
| ECS task definition family | `jinro-backend-staging` | ECS Console > Task Definitions | Must match GitHub Variable `STAGING_ECS_TASK_FAMILY` |
| ECS task execution role ARN | `arn:aws:iam::<account-id>:role/<execution-role>` | IAM Console > Roles | Copy into GitHub Variable `STAGING_ECS_TASK_EXECUTION_ROLE_ARN` |
| ECS task role ARN | `arn:aws:iam::<account-id>:role/<task-role>` | IAM Console > Roles | Copy into GitHub Variable `STAGING_ECS_TASK_ROLE_ARN` |
| ECS private subnet IDs | `subnet-aaaa,subnet-bbbb` | ECS Service / RunTask network configuration | Copy into GitHub Variable `STAGING_ECS_SUBNET_IDS` |
| ECS task security group IDs | `sg-aaaa` | ECS Service / RunTask network configuration | Copy into GitHub Variable `STAGING_ECS_SECURITY_GROUP_IDS` |
| ECS assign public IP | `DISABLED` | ECS Service / RunTask network configuration | Copy into GitHub Variable `STAGING_ECS_ASSIGN_PUBLIC_IP` |
| CloudWatch log group | `/ecs/jinro-backend-staging` | CloudWatch Console > Log groups | Copy into GitHub Variable `STAGING_ECS_LOG_GROUP` |
| ALB staging hostname | `https://api-staging.example.com` | Route53 / ALB / DNS setup | Copy into GitHub Variable `STAGING_APP_BASE_URL` |
| Amplify staging origin | `https://staging.example.amplifyapp.com` | Amplify Console domain view | Copy into GitHub Variable `STAGING_CORS_ORIGIN` |
| Secrets prefix | `/jinro-nachimban/staging/backend` | Secrets Manager naming policy | Copy into GitHub Variable `STAGING_AWS_SECRETS_PREFIX` |
| `DATABASE_URL` secret ARN | `arn:aws:secretsmanager:...:secret:...` | Secrets Manager > Secret create | Copy into GitHub Variable `STAGING_DATABASE_URL_SECRET_ARN` |
| `JWT_ACCESS_SECRET` secret ARN | `arn:aws:secretsmanager:...:secret:...` | Secrets Manager > Secret create | Copy into GitHub Variable `STAGING_JWT_ACCESS_SECRET_ARN` |
| `JWT_REFRESH_SECRET` secret ARN | `arn:aws:secretsmanager:...:secret:...` | Secrets Manager > Secret create | Copy into GitHub Variable `STAGING_JWT_REFRESH_SECRET_ARN` |
| `JWT_STREAM_SECRET` secret ARN | `arn:aws:secretsmanager:...:secret:...` | Secrets Manager > Secret create | Copy into GitHub Variable `STAGING_JWT_STREAM_SECRET_ARN` |
| `AI_API_KEY` secret ARN | `arn:aws:secretsmanager:...:secret:...` | Secrets Manager > Secret create | Copy into GitHub Variable `STAGING_AI_API_KEY_SECRET_ARN`; blank is allowed when unused |
| OIDC assume role ARN | `arn:aws:iam::<account-id>:role/<github-oidc-role>` | IAM Console > Roles | Copy into GitHub Variable `STAGING_AWS_OIDC_ROLE_ARN` |

## GitHub repo settings values to enter manually

| Item | Entered in | Source |
| --- | --- | --- |
| `STAGING_AWS_OIDC_ROLE_ARN` | GitHub Repo > Settings > Secrets and variables > Actions > Variables | IAM OIDC role ARN |
| `STAGING_ECS_CLUSTER` | GitHub Variables | ECS cluster name |
| `STAGING_ECS_SERVICE` | GitHub Variables | ECS service name |
| `STAGING_ECS_TASK_FAMILY` | GitHub Variables | ECS task definition family |
| `STAGING_ECS_TASK_EXECUTION_ROLE_ARN` | GitHub Variables | IAM execution role ARN |
| `STAGING_ECS_TASK_ROLE_ARN` | GitHub Variables | IAM task role ARN |
| `STAGING_ECS_SUBNET_IDS` | GitHub Variables | Private subnet IDs, comma-separated |
| `STAGING_ECS_SECURITY_GROUP_IDS` | GitHub Variables | Task security group IDs, comma-separated |
| `STAGING_ECS_ASSIGN_PUBLIC_IP` | GitHub Variables | `DISABLED` recommended |
| `STAGING_ECS_LOG_GROUP` | GitHub Variables | CloudWatch log group name |
| `STAGING_APP_BASE_URL` | GitHub Variables | Staging ALB base URL |
| `STAGING_CORS_ORIGIN` | GitHub Variables | Amplify staging origin |
| `STAGING_AWS_SECRETS_PREFIX` | GitHub Variables | Secrets Manager naming prefix |
| `STAGING_DATABASE_URL_SECRET_ARN` | GitHub Variables | Secrets Manager ARN |
| `STAGING_JWT_ACCESS_SECRET_ARN` | GitHub Variables | Secrets Manager ARN |
| `STAGING_JWT_REFRESH_SECRET_ARN` | GitHub Variables | Secrets Manager ARN |
| `STAGING_JWT_STREAM_SECRET_ARN` | GitHub Variables | Secrets Manager ARN |
| `STAGING_AI_API_KEY_SECRET_ARN` | GitHub Variables | Optional Secrets Manager ARN |

## Already in repo and code-verifiable

| Item | Verification method | File |
| --- | --- | --- |
| Runtime key set alignment | `npm run verify:staging-config` | `backend/.env.example`, `backend/docs/aws-staging-env.md`, `backend/deploy/ecs/task-definition.staging.json` |
| Task definition JSON structure | `npm run verify:taskdef` | `backend/deploy/ecs/task-definition.staging.json` |
| CD workflow deploy order | File review | `.github/workflows/cd-staging.yml` |
| Migrate-before-rollout order | File review | `.github/workflows/cd-staging.yml`, `backend/docs/deploy-runbook.md` |
| Human input inventory | Document review | `backend/docs/aws-staging-env.md`, `backend/docs/staging-deploy-checklist.md`, `backend/docs/staging-resource-map.md` |

## Not verifiable until real AWS resources exist

| Item | Why it cannot be verified from the repo |
| --- | --- |
| ECS cluster and service existence | Repository files cannot prove AWS resource creation state |
| ALB listener, target group, and hostname wiring | Needs real ALB, listener, and DNS records |
| Private subnet and security group routing | Needs real VPC resources and security group rules |
| Secrets Manager secret ARN validity | Needs real secrets plus read permission |
| GitHub Variables presence | Requires a human to populate repo settings |
| End-to-end staging deployment success | Needs real ECS, ALB, IAM, and VPC resources |

## Related documents

- `backend/docs/aws-staging-env.md`
- `backend/docs/staging-deploy-checklist.md`
- `backend/docs/deploy-runbook.md`
