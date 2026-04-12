import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { console, process } = globalThis;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

const envExamplePath = path.join(backendRoot, ".env.example");
const awsEnvDocPath = path.join(backendRoot, "docs", "aws-staging-env.md");
const taskDefinitionPath = path.join(backendRoot, "deploy", "ecs", "task-definition.staging.json");

function readFile(filePath) {
  return readFileSync(filePath, "utf8");
}

function parseEnvKeys(content) {
  return new Set(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.split("=", 1)[0]?.trim())
      .filter(Boolean),
  );
}

function extractSection(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`## ${escaped}\\r?\\n([\\s\\S]*?)(\\r?\\n## |$)`));
  if (!match) {
    throw new Error(`Section not found: ${heading}`);
  }

  return match[1];
}

function parseDocKeys(markdown) {
  const section = extractSection(markdown, "Container environment keys");
  return new Set(
    Array.from(section.matchAll(/\|\s*`([^`]+)`\s*\|/g), (match) => match[1]).filter(Boolean),
  );
}

function parseTaskDefinitionKeys(content) {
  const json = JSON.parse(content);
  const container = json.containerDefinitions?.[0];
  if (!container) {
    throw new Error("Task definition is missing the first container definition.");
  }

  const envNames = (container.environment ?? []).map((entry) => entry?.name).filter(Boolean);
  const secretNames = (container.secrets ?? []).map((entry) => entry?.name).filter(Boolean);

  return new Set([...envNames, ...secretNames]);
}

function difference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

function fail(message, diff) {
  console.error(message);
  if (diff.length > 0) {
    console.error(`  ${diff.join(", ")}`);
  }
  process.exitCode = 1;
}

const envKeys = parseEnvKeys(readFile(envExamplePath));
const docKeys = parseDocKeys(readFile(awsEnvDocPath));
const taskKeys = parseTaskDefinitionKeys(readFile(taskDefinitionPath));

const envOnlyVsDoc = difference(envKeys, docKeys);
const docOnlyVsEnv = difference(docKeys, envKeys);
const envOnlyVsTask = difference(envKeys, taskKeys);
const taskOnlyVsEnv = difference(taskKeys, envKeys);

if (envOnlyVsDoc.length > 0) {
  fail("Keys present in .env.example but missing from docs/aws-staging-env.md:", envOnlyVsDoc);
}

if (docOnlyVsEnv.length > 0) {
  fail("Keys present in docs/aws-staging-env.md but missing from .env.example:", docOnlyVsEnv);
}

if (envOnlyVsTask.length > 0) {
  fail("Keys present in .env.example but missing from deploy/ecs/task-definition.staging.json:", envOnlyVsTask);
}

if (taskOnlyVsEnv.length > 0) {
  fail("Keys present in deploy/ecs/task-definition.staging.json but missing from .env.example:", taskOnlyVsEnv);
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("validate-staging-env: ok");
console.log(`  .env.example keys: ${envKeys.size}`);
console.log(`  aws-staging-env.md keys: ${docKeys.size}`);
console.log(`  task-definition keys: ${taskKeys.size}`);
