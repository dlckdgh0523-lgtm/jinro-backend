import type { Router } from "express";
import { prisma } from "../infra/prisma";
import { asyncHandler, sendSuccess } from "../common/http";

export const registerHealthRoutes = (router: Router) => {
  router.get(
    "/health",
    asyncHandler(async (req, res) => {
      sendSuccess(req, res, {
        status: "ok",
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
      });
    })
  );

  router.get(
    "/health/ready",
    asyncHandler(async (req, res) => {
      await prisma.$queryRaw`SELECT 1`;
      sendSuccess(req, res, {
        status: "ready",
        database: "reachable",
        timestamp: new Date().toISOString()
      });
    })
  );
};
