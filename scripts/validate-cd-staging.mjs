import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { console, process } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(backendRoot, "..");

const workflowPath = path.join(workspaceRoot, ".github", "workflows", "cd-staging.yml");
const taskDefinitionPath = path.join(backendRoot, "deploy", "ecs", "task-definition.staging.json");

function fail(message) {
  console.error(`validate-cd-staging: ${message}`);
  process.exit(1);
}

function expect(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function extractRequiredVars(content) {
  const blockMatch = content.match(/required_vars=\(\s*([\s\S]*?)\s*\)/);
  if (!blockMatch) {
    fail("required_vars block not found in cd-staging workflow.");
  }

  return new Set(
    blockMatch[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^"|"$/g, "")),
  );
}

function indexOfOrFail(content, needle, label) {
  const index = content.indexOf(needle);
  if (index === -1) {
    fail(`${label} not found.`);
  }

  return index;
}

const workflow = readFileSync(workflowPath, "utf8");
const taskDefinition = JSON.parse(readFileSync(taskDefinitionPath, "utf8"));
const container = taskDefinition.containerDefinitions?.[0];

expect(Boolean(container), "task definition must contain the backend container.");
expect(workflow.includes("workflow_dispatch:"), "workflow_dispatch trigger is required.");
expect(workflow.includes("ECR_REPOSITORY: jinro/backend"), "ECR repository must remain jinro/backend.");
expect(
  workflow.includes('"$WORKDIR/deploy/ecs/task-definition.staging.json"'),
  "workflow must render backend/deploy/ecs/task-definition.staging.json.",
);
expect(
  workflow.includes('docker build -t "$IMAGE_URI" "$WORKDIR"'),
  "workflow must build the backend Docker image from WORKDIR.",
);
expect(workflow.includes('docker push "$IMAGE_URI"'), "workflow must push the rendered image to ECR.");
expect(
  workflow.includes('--task-definition "$TASK_DEF_ARN"'),
  "workflow must pass TASK_DEF_ARN into ECS commands.",
);
expect(
  workflow.includes('command:["sh","-lc","npx prisma migrate deploy"]'),
  "workflow must run prisma migrate deploy as the one-off ECS task command override.",
);
expect(
  workflow.includes('curl --fail --silent --show-error "${{ vars.STAGING_APP_BASE_URL }}/health"'),
  "workflow must run the staging health check against STAGING_APP_BASE_URL.",
);

const requiredVars = extractRequiredVars(workflow);
const expectedRequiredVars = [
  "STAGING_AWS_OIDC_ROLE_ARN",
  "STAGING_ECS_CLUSTER",
  "STAGING_ECS_SERVICE",
  "STAGING_ECS_TASK_FAMILY",
  "STAGING_ECS_TASK_EXECUTION_ROLE_ARN",
  "STAGING_ECS_TASK_ROLE_ARN",
  "STAGING_ECS_SUBNET_IDS",
  "STAGING_ECS_SECURITY_GROUP_IDS",
  "STAGING_ECS_ASSIGN_PUBLIC_IP",
  "STAGING_ECS_LOG_GROUP",
  "STAGING_APP_BASE_URL",
  "STAGING_CORS_ORIGIN",
  "STAGING_AWS_SECRETS_PREFIX",
  "STAGING_DATABASE_URL_SECRET_ARN",
  "STAGING_JWT_ACCESS_SECRET_ARN",
  "STAGING_JWT_REFRESH_SECRET_ARN",
  "STAGING_JWT_STREAM_SECRET_ARN",
];

for (const name of expectedRequiredVars) {
  expect(requiredVars.has(name), `required_vars must include ${name}.`);
}

const envNames = new Set((container.environment ?? []).map((entry) => entry?.name).filter(Boolean));
const secretNames = new Set((container.secrets ?? []).map((entry) => entry?.name).filter(Boolean));

for (const name of ["APP_BASE_URL", "CORS_ORIGIN", "AWS_REGION", "AWS_SECRETS_PREFIX"]) {
  expect(envNames.has(name), `task definition environment must include ${name}.`);
}

for (const name of ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_STREAM_SECRET"]) {
  expect(secretNames.has(name), `task definition secrets must include ${name}.`);
}

const registerIndex = indexOfOrFail(workflow, "name: Register task definition", "register task definition step");
const migrateIndex = indexOfOrFail(workflow, "name: Run prisma migrate deploy", "prisma migrate deploy step");
const updateIndex = indexOfOrFail(workflow, "name: Update ECS service", "update ECS service step");

expect(registerIndex < migrateIndex, "prisma migrate deploy must run after task definition registration.");
expect(migrateIndex < updateIndex, "prisma migrate deploy must run before ECS service update.");

console.log("validate-cd-staging: ok");
console.log(`  workflow: ${workflowPath}`);
console.log(`  task definition: ${taskDefinitionPath}`);
