import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { console, process } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const taskDefinitionPath = path.resolve(__dirname, "..", "deploy", "ecs", "task-definition.staging.json");

function fail(message) {
  console.error(`validate-taskdef-staging: ${message}`);
  process.exit(1);
}

function expect(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholderOrArn(value) {
  return isNonEmptyString(value) && (value.startsWith("replace-with-") || value.startsWith("arn:aws:"));
}

let taskDefinition;

try {
  taskDefinition = JSON.parse(readFileSync(taskDefinitionPath, "utf8"));
} catch (error) {
  fail(`task definition is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

expect(isNonEmptyString(taskDefinition.family), "family is required.");
expect(taskDefinition.networkMode === "awsvpc", "networkMode must be awsvpc.");
expect(
  Array.isArray(taskDefinition.requiresCompatibilities) &&
    taskDefinition.requiresCompatibilities.includes("FARGATE"),
  "requiresCompatibilities must include FARGATE.",
);
expect(isNonEmptyString(taskDefinition.cpu), "cpu is required.");
expect(isNonEmptyString(taskDefinition.memory), "memory is required.");
expect(
  isPlaceholderOrArn(taskDefinition.executionRoleArn),
  "executionRoleArn must be a placeholder or IAM role ARN.",
);
expect(
  isPlaceholderOrArn(taskDefinition.taskRoleArn),
  "taskRoleArn must be a placeholder or IAM role ARN.",
);
expect(
  Array.isArray(taskDefinition.containerDefinitions) && taskDefinition.containerDefinitions.length > 0,
  "containerDefinitions must contain at least one container.",
);

const container = taskDefinition.containerDefinitions[0];

expect(container.name === "backend", "the first container name must be backend.");
expect(isNonEmptyString(container.image), "container image is required.");
expect(container.essential === true, "container must be marked essential.");
expect(Array.isArray(container.portMappings) && container.portMappings.length > 0, "portMappings are required.");
expect(
  container.portMappings.some(
    (mapping) => mapping?.containerPort === 4000 && mapping?.protocol === "tcp",
  ),
  "container must expose tcp/4000.",
);
expect(Array.isArray(container.environment), "environment must be an array.");
expect(Array.isArray(container.secrets), "secrets must be an array.");
expect(
  container.secrets.some((secret) => secret?.name === "DATABASE_URL"),
  "DATABASE_URL secret mapping is required.",
);
expect(
  container.secrets.every((secret) => isPlaceholderOrArn(secret?.valueFrom)),
  "every secret valueFrom must be a placeholder or Secrets Manager ARN.",
);
expect(
  container.logConfiguration?.logDriver === "awslogs",
  "logConfiguration.logDriver must be awslogs.",
);
expect(
  isNonEmptyString(container.logConfiguration?.options?.["awslogs-group"]),
  "awslogs-group is required.",
);
expect(
  isNonEmptyString(container.logConfiguration?.options?.["awslogs-region"]),
  "awslogs-region is required.",
);
expect(
  isNonEmptyString(container.logConfiguration?.options?.["awslogs-stream-prefix"]),
  "awslogs-stream-prefix is required.",
);
expect(Array.isArray(container.healthCheck?.command) && container.healthCheck.command.length > 0, "healthCheck.command is required.");
expect(
  Number.isInteger(container.healthCheck?.interval) && container.healthCheck.interval > 0,
  "healthCheck.interval must be a positive integer.",
);
expect(
  Number.isInteger(container.healthCheck?.timeout) && container.healthCheck.timeout > 0,
  "healthCheck.timeout must be a positive integer.",
);
expect(
  Number.isInteger(container.healthCheck?.retries) && container.healthCheck.retries > 0,
  "healthCheck.retries must be a positive integer.",
);

console.log("validate-taskdef-staging: ok");
console.log(`  family: ${taskDefinition.family}`);
console.log(`  container: ${container.name}`);
