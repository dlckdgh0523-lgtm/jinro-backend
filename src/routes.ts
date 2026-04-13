import { Router } from "express";
import { registerAdmissionRoutes } from "./modules/admissions";
import { registerAiRoutes } from "./modules/ai";
import { registerAuthRoutes } from "./modules/auth";
import { registerCounselingRoutes } from "./modules/counseling";
import { registerInquiryRoutes } from "./modules/inquiry";
import { registerDashboardRoutes } from "./modules/dashboard";
import { registerGoalRoutes } from "./modules/goals";
import { registerGradeRoutes } from "./modules/grades";
import { registerHealthRoutes } from "./modules/health";
import { registerMeRoutes } from "./modules/me";
import { registerNotificationRoutes } from "./modules/notifications";
import { registerStudyPlanRoutes } from "./modules/study-plans";

export const buildRoutes = () => {
  const router = Router();

  router.get("/", (_req, res) => {
    res.status(200).json({ message: "jinro-nachimban-backend is running" });
  });

  registerHealthRoutes(router);

  const v1Router = Router();
  router.use("/v1", v1Router);

  registerAuthRoutes(v1Router);
  registerMeRoutes(v1Router);
  registerStudyPlanRoutes(v1Router);
  registerNotificationRoutes(v1Router);
  registerGradeRoutes(v1Router);
  registerGoalRoutes(v1Router);
  registerCounselingRoutes(v1Router);
  registerDashboardRoutes(v1Router);
  registerAdmissionRoutes(v1Router);
  registerAiRoutes(v1Router);
  registerInquiryRoutes(v1Router);

  return router;
};
