import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

declare global {
  var __jinroPrisma__: PrismaClient | undefined;
}

const createClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"]
  });

export const prisma = global.__jinroPrisma__ ?? createClient();

if (env.NODE_ENV !== "production") {
  global.__jinroPrisma__ = prisma;
}
