import "dotenv/config";
import { execSync } from "child_process";
import { buildApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./infra/prisma";

const runMigrations = async () => {
  if (env.NODE_ENV === "production") {
    try {
      console.log("Running Prisma migrations...");
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("Migrations completed successfully");
    } catch (error) {
      console.error("Migration failed:", error);
      process.exit(1);
    }
  }
};

const startServer = async () => {
  await runMigrations();

  const app = buildApp();

  const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`jinro-nachimban-backend listening on 0.0.0.0:${env.PORT}`);
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
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
