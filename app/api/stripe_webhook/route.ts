import { routeHandler } from "@/lib/api/handler";
import { constructStripeWebhookEvent, processStripeWebhookEvent } from "@/lib/stripe/webhook";

export const runtime = "nodejs";

export const POST = routeHandler(async (request) => {
  const rawBody = await request.text();
  const event = constructStripeWebhookEvent(rawBody, request.headers.get("stripe-signature"));

  return processStripeWebhookEvent(event);
});
