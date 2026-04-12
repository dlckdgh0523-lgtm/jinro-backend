import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { Request, RequestHandler, Response } from "express";

import { prisma } from "./prisma";
import type { AuthClaims } from "./security";

type AuditContext = {
  actorType?: "USER" | "SYSTEM" | "JOB";
  actorUserId?: string | null;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  beforeJson?: unknown;
  afterJson?: unknown;
};

type AuditableRequest = Request & {
  auth?: AuthClaims;
  requestId?: string;
  auditContext?: AuditContext;
};

const hashOptional = (value?: string | null) =>
  value ? createHash("sha256").update(value).digest("hex") : null;

const normalizePath = (req: Request) => req.originalUrl.split("?")[0] ?? req.path;

const toInputJson = (value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined => {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
};

const deriveResourceType = (req: Request) => {
  const segments = normalizePath(req).split("/").filter(Boolean);
  return segments[1] ?? segments[0] ?? "unknown";
};

const deriveResourceId = (req: Request) => {
  const paramValue = Object.values(req.params).find((value) => typeof value === "string");
  return paramValue ?? normalizePath(req);
};

export const setAuditContext = (req: Request, patch: Partial<AuditContext>) => {
  const auditableRequest = req as AuditableRequest;
  auditableRequest.auditContext = {
    ...(auditableRequest.auditContext ?? {}),
    ...patch
  };
};

export const attachAuditLifecycle: RequestHandler = (req, res, next) => {
  const auditableRequest = req as AuditableRequest;
  let finished = false;

  const persist = async (response: Response) => {
    if (finished) {
      return;
    }

    finished = true;
    const requestPath = normalizePath(req);

    if (!requestPath.startsWith("/v1") || ["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return;
    }

    if (response.statusCode >= 400) {
      return;
    }

    const context = auditableRequest.auditContext ?? {};

    await prisma.auditLog.create({
      data: {
        actorType: context.actorType ?? (auditableRequest.auth ? "USER" : "SYSTEM"),
        actorUserId: context.actorUserId ?? auditableRequest.auth?.sub ?? null,
        action: context.action ?? `${req.method} ${requestPath}`,
        resourceType: context.resourceType ?? deriveResourceType(req),
        resourceId: context.resourceId ?? deriveResourceId(req),
        requestId: auditableRequest.requestId ?? null,
        ipHash: hashOptional(req.ip),
        userAgentHash: hashOptional(req.get("user-agent")),
        beforeJson: toInputJson(context.beforeJson),
        afterJson: toInputJson(context.afterJson)
      }
    });
  };

  res.on("finish", () => {
    void persist(res).catch(() => undefined);
  });

  next();
};
