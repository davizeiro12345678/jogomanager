import { describe, expect, it, vi } from "vitest";

vi.mock("../public/payments/webhook", () => ({
  handleStripeWebhookPost: vi.fn(async () => new Response("signed POST delegated")),
}));

import { Route } from "./webhook";
import { handleStripeWebhookPost } from "../public/payments/webhook";

const handlers = (
  Route as unknown as {
    options: {
      server: {
        handlers: {
          GET(): Promise<Response>;
          POST: typeof handleStripeWebhookPost;
        };
      };
    };
  }
).options.server.handlers;

describe("public Stripe webhook compatibility route", () => {
  it("GET is a read-only contract response and exposes no environment secrets", async () => {
    const response = await handlers.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({
      service: "stripe-webhook",
      method: "POST",
      signatureRequired: true,
    });
    expect(handleStripeWebhookPost).not.toHaveBeenCalled();
  });

  it("POST delegates to the existing signature-verifying payment handler", async () => {
    const request = new Request("https://jogomanager.com/api/stripe/webhook?env=sandbox", {
      method: "POST",
      body: "{}",
    });
    const response = await handlers.POST({ request });
    expect(response.status).toBe(200);
    expect(handleStripeWebhookPost).toHaveBeenCalledOnce();
    expect(handleStripeWebhookPost).toHaveBeenCalledWith({ request });
  });
});
