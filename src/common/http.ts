import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodError, ZodTypeAny } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export interface RequestContextRequest extends Request {
  requestId?: string;
}

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
  meta?: Record<string, unknown>;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  public constructor(statusCode: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const sendSuccess = <TData>(
  req: RequestContextRequest,
  res: Response,
  data: TData,
  meta?: Record<string, unknown>,
  statusCode = 200
) => {
  const body: ApiSuccess<TData> = {
    success: true,
    data,
    requestId: req.requestId ?? "unknown"
  };

  if (meta) {
    body.meta = meta;
  }

  return res.status(statusCode).json(body);
};

export const asyncHandler =
  <TReq extends Request = Request>(
    handler: (req: TReq, res: Response, next: NextFunction) => unknown | Promise<unknown>
  ): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req as TReq, res, next)).catch(next);

const mapZodIssues = (error: ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code
  }));

export const validate =
  (schema: ZodTypeAny, target: "body" | "query" | "params" = "body"): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const result = await schema.safeParseAsync(req[target]);

    if (!result.success) {
      return next(
        new ApiError(400, "VALIDATION_ERROR", "Request validation failed.", mapZodIssues(result.error))
      );
    }

    req[target] = result.data;
    return next();
  });

export const attachRequestContext: RequestHandler = (req: RequestContextRequest, res, next) => {
  const headerValue = req.headers["x-request-id"];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  req.requestId = requestId ?? randomUUID();
  res.setHeader("x-request-id", req.requestId ?? "unknown");
  next();
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, "NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (
  error: Error,
  req: RequestContextRequest,
  res: Response,
  _next: NextFunction
) => {
  if (res.headersSent) {
    return;
  }

  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const code: ApiErrorCode = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
  const details = error instanceof ApiError ? error.details : undefined;

  const body: ApiFailure = {
    success: false,
    error: {
      code,
      message:
        code === "INTERNAL_ERROR" && process.env.NODE_ENV === "production"
          ? "Unexpected server error."
          : error.message,
      details
    },
    requestId: req.requestId ?? "unknown"
  };

  res.status(statusCode).json(body);
};

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const makePagination = (page: number, pageSize: number, totalItems: number): Pagination => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};
