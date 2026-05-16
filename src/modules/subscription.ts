import type { Router } from "express";
import { authenticate } from "../infra/security";
import { asyncHandler, sendSuccess, validate } from "../common/http";
import { setAuditContext } from "../infra/audit";
import type { AuthenticatedRequest } from "../infra/security";
import { createSubscriptionSchema, cancelSubscriptionSchema, paymentWebhookSchema } from "./subscription.validator";
import { subscriptionService } from "./subscription.service";

export const registerSubscriptionRoutes = (router: Router) => {
  router.get(
    "/subscriptions/me",
    authenticate,
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const subscriptions = await subscriptionService.getUserSubscriptions(auth!.sub);
      sendSuccess(req, res, subscriptions);
    })
  );

  router.get(
    "/subscriptions/me/active",
    authenticate,
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const subscription = await subscriptionService.getActiveSubscription(auth!.sub);
      sendSuccess(req, res, subscription);
    })
  );

  router.post(
    "/subscriptions",
    authenticate,
    validate(createSubscriptionSchema),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const subscription = await subscriptionService.createSubscription(auth!.sub, req.body);
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: auth!.sub,
        action: "SUBSCRIPTION_CREATED",
        resourceType: "subscription",
        resourceId: subscription.id,
        afterJson: { planType: subscription.planType, status: subscription.status }
      });
      sendSuccess(req, res, subscription, undefined, 201);
    })
  );

  router.post(
    "/subscriptions/:subscriptionId/cancel",
    authenticate,
    validate(cancelSubscriptionSchema),
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const subscription = await subscriptionService.cancelSubscription(
        auth!.sub,
        req.params.subscriptionId as string,
        req.body.reason
      );
      setAuditContext(req, {
        actorType: "USER",
        actorUserId: auth!.sub,
        action: "SUBSCRIPTION_CANCELED",
        resourceType: "subscription",
        resourceId: req.params.subscriptionId as string
      });
      sendSuccess(req, res, subscription);
    })
  );

  router.get(
    "/subscriptions/access",
    authenticate,
    asyncHandler(async (req, res) => {
      const { auth } = req as AuthenticatedRequest;
      const access = await subscriptionService.checkAccess(auth!.sub);
      sendSuccess(req, res, access);
    })
  );

  router.post(
    "/webhooks/payment",
    validate(paymentWebhookSchema),
    asyncHandler(async (req, res) => {
      const result = await subscriptionService.handlePaymentWebhook(req.body);
      sendSuccess(req, res, result);
    })
  );
};
