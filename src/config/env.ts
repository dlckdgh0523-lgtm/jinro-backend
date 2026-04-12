import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  CORS_ORIGIN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_STREAM_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("14d"),
  JWT_STREAM_EXPIRES_IN: z.string().default("60s"),
  REFRESH_TOKEN_COOKIE_NAME: z.string().default("jinro_refresh_token"),
  ACCESS_TOKEN_HEADER_NAME: z.string().default("authorization"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  SSE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  SSE_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(3000),
  AI_PROVIDER: z.string().default("stub"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL_DEFAULT: z.string().default("stub-chat-model"),
  AI_EMBEDDING_MODEL: z.string().default("stub-embedding-model"),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AWS_REGION: z.string().default("ap-northeast-2"),
  AWS_S3_BUCKET: z.string().optional().default(""),
  AWS_SECRETS_PREFIX: z.string().default("/jinro-nachimban/backend")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const env = {
  ...parsed.data,
  corsOrigins: splitCsv(parsed.data.CORS_ORIGIN)
};

export type AppEnv = typeof env;
