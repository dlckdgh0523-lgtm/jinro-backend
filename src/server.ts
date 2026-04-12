import "dotenv/config";
import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./infra/prisma";

const app = buildApp();

const server = app.listen(env.PORT, () => {
  console.log(`jinro-nachimban-backend listening on ${env.PORT}`);
});

const shutdown = async (signal: string) => {
  console.log(`received ${signal}, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
