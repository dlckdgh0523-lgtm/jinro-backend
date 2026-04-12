import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { attachRequestContext, errorHandler, notFoundHandler } from "./common/http";
import { attachAuditLifecycle } from "./infra/audit";
import { buildRoutes } from "./routes";

const logger = pino({
  level: env.LOG_LEVEL
});

export const buildApp = () => {
  const app = express();

  app.set("trust proxy", env.NODE_ENV === "production");
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        requestId: req.headers["x-request-id"]
      }),
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.body.password",
          "req.body.passwordConfirm",
          "req.body.refreshToken"
        ],
        censor: "[REDACTED]"
      }
    })
  );
  app.use(attachRequestContext);
  app.use(attachAuditLifecycle);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Blocked by configured CORS policy."));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    "/v1/auth",
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.AUTH_RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(buildRoutes());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
