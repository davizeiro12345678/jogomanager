import type { Json } from "@/integrations/supabase/types";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fulfillOneTimePurchase,
  recordPendingPurchase,
  syncSubscriptionForUser,
} from "@/lib/fulfillment.server";
import {
  type StripeEnv,
  createStripeClient,
  getConfiguredStripeEnvironment,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  assertStoreProductKey,
  getServerStoreProduct,
  getStoreServiceSupabase,
  parseStoreProductContents,
  resolveValidatedStripePrice,
  checkoutDiscountParams,
  type ServerStoreProduct,
  type StoreProductContents,
} from "@/lib/store-products.server";
import { classifyGuestCheckoutSession } from "@/lib/guest-checkout-state";
import { persistGuestCheckoutIntentIfAllowed } from "@/lib/guest-checkout-policy.server";
import { resolveOrCreateCustomer } from "@/utils/payments.functions";
import { assertGuestCheckoutEnabled } from "@/lib/payments-config.server";

// Stripe requires at least 30 minutes from receipt. Keep a margin so request
// transit cannot make an otherwise valid embedded session intermittently fail.
const INTENT_TTL_MS = 31 * 60 * 1000;
const CONSENT_VERSION = "guest-checkout-v1";

type GuestIntentState =
  "created" | "checkout_open" | "paid" | "claiming" | "claimed" | "expired" | "failed";

interface GuestIntentRow {
  id: string;
  product_key: string;
  email_hash: string;
  environment: StripeEnv;
  state: GuestIntentState;
  amount_cents: number;
  currency: string;
  contents_snapshot: StoreProductContents;
  stripe_price_id: string | null;
  stripe_customer_id: string | null;
  stripe_session_id: string | null;
  open_key: string | null;
  claimed_by_user_id: string | null;
  expires_at: string;
}

export type StartGuestCheckoutResult =
  { clientSecret: string; intentId: string; environment: StripeEnv } | { error: string };

export type GuestCheckoutStatus =
  | { status: "pending" | "paid"; intentId: string }
  | { status: "invalid" | "expired"; message: string };

export type ClaimGuestCheckoutResult =
  | { status: "delivered"; productKey: string }
  | { status: "pending"; message: string }
  | { status: "error"; message: string };

function getServiceSupabase() {
  return getStoreServiceSupabase();
}

function isStripeEnvironment(value: unknown): value is StripeEnv {
  return value === "sandbox" || value === "live";
}

function normalizeGuestEmail(value: unknown): string {
  if (typeof value !== "string") throw new Error("Informe um e-mail válido.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  return email;
}

async function hashGuestEmail(email: string): Promise<string> {
  const secret = process.env["GUEST_CHECKOUT_EMAIL_HASH_SECRET"];
  if (!secret) throw new Error("Chave de segurança do checkout ausente.");
  const input = new TextEncoder().encode(`${secret}\u0000${email}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertIntentId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) {
    throw new Error("Identificador de compra inválido.");
  }
}

function assertStripeSessionId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^cs_[a-zA-Z0-9_]+$/.test(value)) {
    throw new Error("Sessão de pagamento inválida.");
  }
}

function isExpired(intent: GuestIntentRow): boolean {
  return new Date(intent.expires_at).getTime() <= Date.now();
}

function guestOpenKey(environment: StripeEnv, emailHash: string, productKey: string): string {
  return `${environment}:${emailHash}:${productKey}`;
}

function hasMatchingContentsSnapshot(
  snapshot: unknown,
  productContents: StoreProductContents,
): boolean {
  const parsed = parseStoreProductContents(snapshot);
  return (
    parsed !== null &&
    parsed.coins === productContents.coins &&
    parsed.scoutReports === productContents.scoutReports &&
    parsed.trainingBoosts === productContents.trainingBoosts &&
    parsed.themes.length === productContents.themes.length &&
    parsed.themes.every((theme, index) => theme === productContents.themes[index])
  );
}

async function readIntent(intentId: string): Promise<GuestIntentRow | null> {
  const { data, error } = await getServiceSupabase()
    .from("guest_checkout_intents")
    .select(
      "id, product_key, email_hash, environment, state, amount_cents, currency, contents_snapshot, stripe_price_id, stripe_customer_id, stripe_session_id, open_key, claimed_by_user_id, expires_at",
    )
    .eq("id", intentId)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível consultar a compra: ${error.message}`);
  return (data as GuestIntentRow | null) ?? null;
}

async function markIntentPaid(intentId: string, sessionId: string): Promise<void> {
  const { error } = await getServiceSupabase()
    .from("guest_checkout_intents")
    .update({ state: "paid", stripe_session_id: sessionId, error: null })
    .eq("id", intentId)
    .eq("stripe_session_id", sessionId)
    // Delayed payment methods can settle after the checkout window elapsed.
    // Keep the original, verifiably paid intent claimable instead of dropping
    // a legitimate payment merely because a newer attempt was opened.
    .in("state", ["created", "checkout_open", "paid", "expired"]);
  if (error) throw new Error(`Não foi possível confirmar a compra visitante: ${error.message}`);
}

async function markIntentFailed(intentId: string, sessionId: string): Promise<void> {
  const { error } = await getServiceSupabase()
    .from("guest_checkout_intents")
    .update({
      state: "failed",
      open_key: null,
      error: "Pagamento não foi concluído",
    })
    .eq("id", intentId)
    .eq("stripe_session_id", sessionId)
    .in("state", ["created", "checkout_open", "expired"]);
  if (error)
    throw new Error(`Não foi possível registrar a falha do pagamento visitante: ${error.message}`);
}

async function expireIntent(intent: GuestIntentRow): Promise<void> {
  await getServiceSupabase()
    .from("guest_checkout_intents")
    .update({ state: "expired", open_key: null, error: "Checkout expirado" })
    .eq("id", intent.id)
    .neq("state", "claimed");
}

async function inspectExistingGuestCheckoutSession(
  intent: GuestIntentRow,
): Promise<ReturnType<typeof classifyGuestCheckoutSession>> {
  if (!intent.stripe_session_id) return "closed";
  const stripe = createStripeClient(intent.environment);
  const session = await stripe.checkout.sessions.retrieve(intent.stripe_session_id);
  if (session.metadata?.["guestCheckoutIntentId"] !== intent.id) {
    throw new Error("A sessão existente não corresponde à compra visitante.");
  }
  const disposition = classifyGuestCheckoutSession(session.status, session.payment_status);
  if (disposition === "paid") await markIntentPaid(intent.id, session.id);
  return disposition;
}

async function reserveGuestCheckoutAttempt(emailHash: string): Promise<void> {
  const { data, error } = await getServiceSupabase().rpc("reserve_guest_checkout_attempt", {
    _email_hash: emailHash,
  });
  if (error) throw new Error("Não foi possível validar o limite de tentativas.");
  if (data !== true) {
    throw new Error("Muitas tentativas de checkout. Aguarde alguns minutos e tente novamente.");
  }
}

async function createIntent(
  environment: StripeEnv,
  emailHash: string,
  product: ServerStoreProduct,
): Promise<GuestIntentRow> {
  const db = getServiceSupabase();
  const openKey = guestOpenKey(environment, emailHash, product.key);
  const { data: existing, error: existingError } = await db
    .from("guest_checkout_intents")
    .select(
      "id, product_key, email_hash, environment, state, amount_cents, currency, contents_snapshot, stripe_price_id, stripe_customer_id, stripe_session_id, open_key, claimed_by_user_id, expires_at",
    )
    .eq("open_key", openKey)
    .maybeSingle();
  if (existingError)
    throw new Error(`Não foi possível preparar o checkout: ${existingError.message}`);

  if (existing) {
    const intent = existing as unknown as GuestIntentRow;
    const hasCurrentSnapshot =
      intent.amount_cents === product.priceCents &&
      intent.currency === product.currency.toUpperCase() &&
      hasMatchingContentsSnapshot(intent.contents_snapshot, product.contents);
    if (["paid", "claiming"].includes(intent.state)) {
      throw new Error("Esta compra já foi paga. Use o link de e-mail para receber o item.");
    }
    if (["created", "checkout_open"].includes(intent.state) && hasCurrentSnapshot) {
      if (!isExpired(intent)) return intent;
      const disposition = await inspectExistingGuestCheckoutSession(intent);
      if (disposition === "paid") {
        throw new Error("Esta compra já foi paga. Use o link de e-mail para receber o item.");
      }
      if (disposition === "open") return intent;
      if (disposition === "settling") {
        throw new Error(
          "O pagamento anterior ainda está em confirmação. Aguarde a Stripe antes de tentar outra compra.",
        );
      }
    }
    await expireIntent(intent);
  }

  await reserveGuestCheckoutAttempt(emailHash);
  const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();
  const { data, error } = await db
    .from("guest_checkout_intents")
    .insert({
      product_key: product.key,
      email_hash: emailHash,
      environment,
      state: "created",
      amount_cents: product.priceCents,
      currency: product.currency.toUpperCase(),
      contents_snapshot: product.contents as unknown as Json,
      open_key: openKey,
      consent_version: CONSENT_VERSION,
      expires_at: expiresAt,
    })
    .select(
      "id, product_key, email_hash, environment, state, amount_cents, currency, contents_snapshot, stripe_price_id, stripe_customer_id, stripe_session_id, open_key, claimed_by_user_id, expires_at",
    )
    .single();
  if (error || !data) {
    // The unique `open_key` also closes the tiny race between two tabs. The
    // winning row is safe to resume; any other failure remains visible.
    if (error?.code === "23505") {
      const retry = await readOpenIntent(openKey);
      if (retry) return retry;
    }
    throw new Error(`Não foi possível criar o checkout: ${error?.message ?? "sem resposta"}`);
  }
  return data as unknown as GuestIntentRow;
}

async function readOpenIntent(openKey: string): Promise<GuestIntentRow | null> {
  const { data, error } = await getServiceSupabase()
    .from("guest_checkout_intents")
    .select(
      "id, product_key, email_hash, environment, state, amount_cents, currency, contents_snapshot, stripe_price_id, stripe_customer_id, stripe_session_id, open_key, claimed_by_user_id, expires_at",
    )
    .eq("open_key", openKey)
    .maybeSingle();
  if (error) throw new Error(`Não foi possível retomar o checkout: ${error.message}`);
  return (data as GuestIntentRow | null) ?? null;
}

async function openStripeSession(
  intent: GuestIntentRow,
  email: string,
  product: ServerStoreProduct,
  environment: StripeEnv,
): Promise<StartGuestCheckoutResult> {
  if (intent.environment !== environment) {
    throw new Error("A intenção de compra não corresponde ao ambiente configurado.");
  }
  const stripe = createStripeClient(environment);
  if (intent.stripe_session_id) {
    const current = await stripe.checkout.sessions.retrieve(intent.stripe_session_id);
    const disposition = classifyGuestCheckoutSession(current.status, current.payment_status);
    if (disposition === "paid") {
      await markIntentPaid(intent.id, current.id);
      return { error: "Esta compra já foi paga. Use o link de e-mail para receber o item." };
    }
    if (disposition === "open" && current.client_secret) {
      return { clientSecret: current.client_secret, intentId: intent.id, environment };
    }
    if (disposition === "settling") {
      // PIX/boleto and other asynchronous methods can complete the Checkout
      // Session while payment_status remains unpaid. It must stay attached to
      // this intent until Stripe emits its later success or failure event.
      throw new Error(
        "O pagamento está em confirmação. Use a página de retorno da Stripe para acompanhar o status.",
      );
    }
    // Stripe idempotency deliberately binds one intent to one session. Once
    // that session is closed, release this intent instead of attempting to
    // reuse its idempotency key and accidentally returning the stale session.
    await expireIntent(intent);
    throw new Error("O checkout anterior expirou. Volte à loja e abra uma nova tentativa.");
  }

  const price = await resolveValidatedStripePrice(stripe, product);
  const customerId = await resolveOrCreateCustomer(stripe, { email });
  const request = getRequest();
  if (!request) throw new Error("Não foi possível determinar o endereço de retorno do checkout.");
  const origin = new URL(request.url).origin;
  const returnUrl = `${origin}/checkout/guest?intent=${encodeURIComponent(intent.id)}&session_id={CHECKOUT_SESSION_ID}`;
  const expiresAt = Math.floor(Date.now() / 1000) + INTENT_TTL_MS / 1000;
  const isRecurring = price.type === "recurring";

  const session = await stripe.checkout.sessions.create(
    {
      line_items: [{ price: price.id, quantity: 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      expires_at: expiresAt,
      ...(await checkoutDiscountParams(stripe, product)),
      metadata: {
        guestCheckoutIntentId: intent.id,
        productKey: product.key,
        purchaseMode: "guest",
      },
      ...(isRecurring && {
        subscription_data: {
          metadata: {
            guestCheckoutIntentId: intent.id,
            productKey: product.key,
            purchaseMode: "guest",
          },
        },
      }),
    } as Parameters<ReturnType<typeof createStripeClient>["checkout"]["sessions"]["create"]>[0],
    { idempotencyKey: `guest-checkout-${intent.id}` },
  );

  if (!session.client_secret) throw new Error("A Stripe não retornou uma sessão de pagamento.");
  const { error } = await getServiceSupabase()
    .from("guest_checkout_intents")
    .update({
      state: "checkout_open",
      stripe_price_id: price.id,
      stripe_customer_id: customerId,
      stripe_session_id: session.id,
      error: null,
    })
    .eq("id", intent.id)
    .in("state", ["created", "checkout_open"]);
  if (error) throw new Error(`Não foi possível salvar a sessão de pagamento: ${error.message}`);
  return { clientSecret: session.client_secret, intentId: intent.id, environment };
}

/**
 * Starts checkout only in the server-selected, explicitly enabled environment.
 * Every commercial value comes from the active database row and is matched
 * against Stripe before a session is created.
 */
export const startGuestCheckout = createServerFn({ method: "POST" })
  // Purchases require a signed-in account; anonymous callers are rejected.
  .middleware([requireSupabaseAuth])
  .validator(
    (data: {
      productKey: string;
      email: string;
      hasPurchaseConsent: boolean;
      clientEnvironment: StripeEnv;
    }) => {
      assertStoreProductKey(data.productKey);
      normalizeGuestEmail(data.email);
      if (data.hasPurchaseConsent !== true) {
        throw new Error("Confirme que você tem autorização para realizar a compra.");
      }
      if (!isStripeEnvironment(data.clientEnvironment)) {
        throw new Error("Ambiente de pagamento inválido.");
      }
      return data;
    },
  )
  .handler(async ({ data }): Promise<StartGuestCheckoutResult> => {
    try {
      const environment = assertGuestCheckoutEnabled();
      if (data.clientEnvironment !== environment) {
        throw new Error(
          "A chave pública de pagamentos não corresponde ao ambiente liberado no servidor.",
        );
      }
      const email = normalizeGuestEmail(data.email);
      const emailHash = await hashGuestEmail(email);
      const product = await getServerStoreProduct(getServiceSupabase(), data.productKey);
      const intent = await persistGuestCheckoutIntentIfAllowed(product, () =>
        createIntent(environment, emailHash, product),
      );
      return await openStripeSession(intent, email, product, environment);
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/** Called by Stripe webhooks; payment is recorded but delivery waits for email-authenticated claim. */
export async function markGuestCheckoutPaid(
  intentId: string,
  sessionId: string,
  environment: StripeEnv,
): Promise<void> {
  if (!isStripeEnvironment(environment)) throw new Error("Ambiente de pagamento inválido.");
  assertIntentId(intentId);
  assertStripeSessionId(sessionId);
  const intent = await readIntent(intentId);
  if (!intent || intent.environment !== environment || intent.stripe_session_id !== sessionId) {
    throw new Error("A sessão não corresponde à compra visitante.");
  }
  await markIntentPaid(intentId, sessionId);
}

/** Called by Stripe after an asynchronous guest payment definitively fails. */
export async function markGuestCheckoutFailed(
  intentId: string,
  sessionId: string,
  environment: StripeEnv,
): Promise<void> {
  if (!isStripeEnvironment(environment)) throw new Error("Ambiente de pagamento inválido.");
  assertIntentId(intentId);
  assertStripeSessionId(sessionId);
  const intent = await readIntent(intentId);
  if (!intent || intent.environment !== environment || intent.stripe_session_id !== sessionId) {
    throw new Error("A sessão não corresponde à compra visitante.");
  }
  await markIntentFailed(intentId, sessionId);
}

export const getGuestCheckoutStatus = createServerFn({ method: "POST" })
  .validator((data: { intentId: string; sessionId: string }) => {
    assertIntentId(data.intentId);
    assertStripeSessionId(data.sessionId);
    return data;
  })
  .handler(async ({ data }): Promise<GuestCheckoutStatus> => {
    try {
      const environment = getConfiguredStripeEnvironment();
      const intent = await readIntent(data.intentId);
      if (
        !intent ||
        !isStripeEnvironment(intent.environment) ||
        intent.environment !== environment ||
        intent.stripe_session_id !== data.sessionId
      ) {
        return { status: "invalid", message: "Não encontramos esta compra visitante." };
      }
      if (intent.state === "failed") {
        return {
          status: "expired",
          message: "O pagamento não foi concluído. Volte à loja para tentar de novo.",
        };
      }
      if (intent.state === "paid" || intent.state === "claimed") {
        return { status: "paid", intentId: intent.id };
      }

      const stripe = createStripeClient(environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      if (session.metadata?.["guestCheckoutIntentId"] !== intent.id) {
        return { status: "invalid", message: "A sessão não corresponde à compra visitante." };
      }
      const disposition = classifyGuestCheckoutSession(session.status, session.payment_status);
      if (disposition === "paid") {
        await markIntentPaid(intent.id, session.id);
        return { status: "paid", intentId: intent.id };
      }
      if (disposition === "settling") {
        return { status: "pending", intentId: intent.id };
      }
      if (intent.state === "expired" || isExpired(intent)) {
        await expireIntent(intent);
        return {
          status: "expired",
          message: "Este checkout expirou. Volte à loja para tentar de novo.",
        };
      }
      return { status: "pending", intentId: intent.id };
    } catch {
      return { status: "invalid", message: "Não foi possível confirmar esta compra agora." };
    }
  });

export const claimGuestCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { intentId: string; sessionId: string }) => {
    assertIntentId(data.intentId);
    assertStripeSessionId(data.sessionId);
    return data;
  })
  .handler(async ({ data, context }): Promise<ClaimGuestCheckoutResult> => {
    try {
      const email = normalizeGuestEmail(context.claims?.email);
      const emailHash = await hashGuestEmail(email);
      const environment = getConfiguredStripeEnvironment();
      const intent = await readIntent(data.intentId);
      if (
        !intent ||
        !isStripeEnvironment(intent.environment) ||
        intent.environment !== environment ||
        intent.stripe_session_id !== data.sessionId
      ) {
        return { status: "error", message: "Não encontramos esta compra visitante." };
      }
      if (intent.state === "failed") {
        return {
          status: "error",
          message: "O pagamento não foi concluído. Volte à loja para tentar de novo.",
        };
      }
      if (intent.email_hash !== emailHash) {
        return { status: "error", message: "Entre com o mesmo e-mail usado no pagamento." };
      }
      if (intent.claimed_by_user_id && intent.claimed_by_user_id !== context.userId) {
        return { status: "error", message: "Esta compra já está vinculada a outra conta." };
      }
      if (intent.state === "claimed")
        return { status: "delivered", productKey: intent.product_key };
      // Only an intent already confirmed paid by the signed Stripe webhook can
      // be delivered; a client request alone never triggers fulfillment.
      if (intent.state !== "paid" && intent.state !== "claiming") {
        return { status: "pending", message: "O pagamento ainda está sendo confirmado." };
      }

      const stripe = createStripeClient(environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["line_items.data.price", "subscription"],
      });
      if (
        session.metadata?.["guestCheckoutIntentId"] !== intent.id ||
        session.metadata?.["productKey"] !== intent.product_key
      ) {
        return { status: "error", message: "A sessão não corresponde à compra visitante." };
      }
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
        return { status: "pending", message: "O pagamento ainda está sendo confirmado." };
      }
      const customerEmail = session.customer_details?.email;
      if (
        !customerEmail ||
        (await hashGuestEmail(normalizeGuestEmail(customerEmail))) !== intent.email_hash
      ) {
        return { status: "error", message: "O e-mail do pagamento não confere com esta compra." };
      }

      const lineItem = session.line_items?.data?.[0];
      // List price before Stripe discounts; sales and promo codes lower only the total.
      const amount = lineItem?.amount_subtotal ?? session.amount_subtotal ?? 0;
      const paymentCurrency = lineItem?.price?.currency ?? session.currency;
      const snapshotContents = parseStoreProductContents(intent.contents_snapshot);
      if (
        !intent.stripe_price_id ||
        !snapshotContents ||
        lineItem?.price?.id !== intent.stripe_price_id ||
        amount !== intent.amount_cents ||
        paymentCurrency?.toUpperCase() !== intent.currency
      ) {
        return {
          status: "error",
          message: "O valor do pagamento não confere com a compra registrada.",
        };
      }

      const { data: claimReserved, error: reserveError } = await getServiceSupabase().rpc(
        "reserve_guest_checkout_claim",
        { _intent_id: intent.id, _user_id: context.userId },
      );
      if (reserveError) throw new Error(reserveError.message);
      if (claimReserved !== true) {
        return { status: "error", message: "Esta compra já está vinculada a outra conta." };
      }

      if (session.mode === "payment") {
        const paidAmount = session.amount_total ?? amount;
        await recordPendingPurchase(context.userId, intent.product_key, session.id, paidAmount);
        await fulfillOneTimePurchase(
          context.userId,
          intent.product_key,
          session.id,
          amount,
          {
            priceCents: intent.amount_cents,
            contents: snapshotContents,
          },
          paidAmount,
        );
      } else {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!subscriptionId) {
          return { status: "pending", message: "A assinatura ainda está sendo criada." };
        }
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await stripe.subscriptions.update(subscription.id, {
          metadata: {
            ...subscription.metadata,
            userId: context.userId,
            guestCheckoutIntentId: intent.id,
          },
        });
        await syncSubscriptionForUser(subscription, context.userId, environment);
      }

      const { error } = await getServiceSupabase()
        .from("guest_checkout_intents")
        .update({
          state: "claimed",
          claimed_by_user_id: context.userId,
          claimed_at: new Date().toISOString(),
          open_key: null,
          error: null,
        })
        .eq("id", intent.id);
      if (error) throw new Error(error.message);
      return { status: "delivered", productKey: intent.product_key };
    } catch (error) {
      console.error("claimGuestCheckout falhou", error);
      return { status: "error", message: "Não foi possível vincular esta compra agora." };
    }
  });
