import Stripe from "stripe";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = "sandbox" | "live";

const GATEWAY_STRIPE_BASE = "https://connector-gateway.lovable.dev/stripe";

function isStripeEnvironment(value: string): value is StripeEnv {
  return value === "sandbox" || value === "live";
}

/**
 * Resolves the payment environment from trusted deployment configuration.
 *
 * `VITE_PAYMENTS_CLIENT_TOKEN` is only a legacy fallback read from the server
 * process at build/deploy time. It is never read from an HTTP request, so a
 * browser cannot switch a production checkout to the sandbox (or the reverse).
 */
export function resolveConfiguredStripeEnvironment(
  options: {
    deploymentEnvironment?: string | undefined;
    clientToken?: string | undefined;
    liveApiKeyConfigured?: boolean | undefined;
  } = {},
): StripeEnv {
  const deploymentEnvironment = options.deploymentEnvironment?.trim().toLowerCase();
  if (deploymentEnvironment && !isStripeEnvironment(deploymentEnvironment)) {
    throw new Error("PAYMENTS_ENVIRONMENT deve ser sandbox ou live.");
  }

  const clientToken = options.clientToken?.trim();
  let tokenEnvironment: StripeEnv | undefined;
  if (clientToken?.startsWith("pk_test_")) tokenEnvironment = "sandbox";
  else if (clientToken?.startsWith("pk_live_")) tokenEnvironment = "live";
  else if (clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN deve ser uma chave pública Stripe válida.");
  }

  const resolvedEnvironment = deploymentEnvironment
    ? isStripeEnvironment(deploymentEnvironment)
      ? deploymentEnvironment
      : undefined
    : options.liveApiKeyConfigured
      ? "live"
      : tokenEnvironment;

  if (resolvedEnvironment && tokenEnvironment && resolvedEnvironment !== tokenEnvironment) {
    throw new Error(
      "PAYMENTS_ENVIRONMENT não corresponde à chave pública Stripe configurada para este deploy.",
    );
  }

  if (resolvedEnvironment) return resolvedEnvironment;

  throw new Error(
    "Pagamentos não configurados para este deploy. Defina PAYMENTS_ENVIRONMENT ou VITE_PAYMENTS_CLIENT_TOKEN.",
  );
}

/**
 * Server-only boundary for checkout, claim, portal, and webhook handlers.
 * A caller must never be allowed to provide this value in a browser payload or
 * make a webhook query string authoritative.
 */
export function getConfiguredStripeEnvironment(): StripeEnv {
  // The preview build ships the test publishable key; let that key decide so
  // the preview runs in sandbox instead of rejecting the live deployment flag.
  const isPreviewBuild = import.meta.env.DEV;
  return resolveConfiguredStripeEnvironment({
    deploymentEnvironment: isPreviewBuild ? undefined : process.env["PAYMENTS_ENVIRONMENT"],
    clientToken: process.env["VITE_PAYMENTS_CLIENT_TOKEN"] ?? import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"],
    liveApiKeyConfigured:
      !isPreviewBuild && Boolean(process.env["STRIPE_LIVE_API_KEY"]?.trim()),
  });
}

export function getConnectionApiKey(env: StripeEnv): string {
  return env === "sandbox" ? getEnv("STRIPE_SANDBOX_API_KEY") : getEnv("STRIPE_LIVE_API_KEY");
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  // Native Stripe keys work directly on Cloudflare. Connector tokens retain
  // the existing Lovable gateway flow for deployments that still use it.
  if (/^(?:sk|rk)_(?:test|live)_/.test(connectionApiKey)) {
    const expected = env === "live" ? /^(?:sk|rk)_live_/ : /^(?:sk|rk)_test_/;
    if (!expected.test(connectionApiKey))
      throw new Error("A chave privada Stripe não corresponde ao ambiente configurado.");
    return new Stripe(connectionApiKey, {
      apiVersion: "2026-09-30.endive",
      httpClient: Stripe.createFetchHttpClient(),
    });
  }
  const lovableApiKey = getEnv("LOVABLE_API_KEY");

  return new Stripe(connectionApiKey, {
    apiVersion: "2026-09-30.endive",
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace("https://api.stripe.com", GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(
              init?.headers ?? (input instanceof Request ? input.headers : undefined),
            ).entries(),
          ),
          "X-Connection-Api-Key": connectionApiKey,
          "Lovable-API-Key": lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };

    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) {
      const details = [
        stripeError.raw?.type ?? stripeError.type,
        stripeError.raw?.code ?? stripeError.code,
        stripeError.raw?.decline_code ?? stripeError.decline_code,
        stripeError.raw?.param ?? stripeError.param,
        stripeError.raw?.requestId ?? stripeError.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(", ")})` : message;
    }
  }

  return "Stripe request failed";
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<Stripe.Event> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret =
    env === "sandbox"
      ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
      : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");

  if (!signature || !body) {
    throw new Error("Missing signature or body");
  }

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t" && value) timestamp = value;
    if (key === "v1" && value) v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) {
    throw new Error("Invalid signature format");
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    throw new Error("Webhook timestamp too old");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");

  if (!v1Signatures.includes(expected)) {
    throw new Error("Invalid webhook signature");
  }

  return JSON.parse(body) as Stripe.Event;
}
