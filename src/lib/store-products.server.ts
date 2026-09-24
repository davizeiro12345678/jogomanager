import type Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Dados comerciais que somente o servidor pode transformar em uma sessão de
 * checkout. O navegador recebe o catálogo para exibição, mas nunca decide
 * preço, moeda, produto Stripe ou benefício entregue.
 */
export interface StoreProductContents {
  coins: number;
  scoutReports: number;
  trainingBoosts: number;
  themes: string[];
}

export interface ServerStoreProduct {
  key: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  kind: string;
  active: boolean;
  stripeLookupKey: string;
  contents: StoreProductContents;
  /** desconto promocional ativo agora (0 = sem promoção) */
  salePercentOff: number;
}

type ProductRow = {
  key: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  kind: string;
  active: boolean;
  stripe_lookup_key: string | null;
  contents: unknown;
  sale_percent_off?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
};

let serviceSupabase: SupabaseClient<Database> | null = null;

/**
 * Private catalog fields are available only to the payment server. Public
 * product cards use explicit column grants and never see Stripe lookup keys or
 * fulfillment contents.
 */
export function getStoreServiceSupabase() {
  if (!serviceSupabase) {
    const url = process.env["SUPABASE_URL"];
    const serviceRole = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceRole) {
      throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para pagamentos.");
    }
    serviceSupabase = createClient<Database>(url, serviceRole);
  }
  return serviceSupabase;
}

export function assertStoreProductKey(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-z0-9_]{2,80}$/.test(value)) {
    throw new Error("Produto inválido.");
  }
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Public function so the DB-backed contents contract can be unit tested. */
export function parseStoreProductContents(value: unknown): StoreProductContents | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const coins = nonNegativeInteger(record["coins"]);
  const scoutReports = nonNegativeInteger(record["scoutReports"]);
  const trainingBoosts = nonNegativeInteger(record["trainingBoosts"]);
  const rawThemes = record["themes"];
  if (
    coins === null ||
    scoutReports === null ||
    trainingBoosts === null ||
    !Array.isArray(rawThemes) ||
    rawThemes.some((theme) => typeof theme !== "string" || theme.length > 80)
  ) {
    return null;
  }

  return {
    coins,
    scoutReports,
    trainingBoosts,
    themes: Array.from(new Set(rawThemes as string[])),
  };
}

function parseProductRow(row: ProductRow): ServerStoreProduct {
  const contents = parseStoreProductContents(row.contents);
  if (!contents) throw new Error(`Conteúdo inválido para o produto ${row.key}.`);
  if (!row.stripe_lookup_key || !/^[a-zA-Z0-9_-]{2,120}$/.test(row.stripe_lookup_key)) {
    throw new Error(`Checkout não configurado para o produto ${row.key}.`);
  }
  if (!Number.isInteger(row.price_cents) || row.price_cents < 0) {
    throw new Error(`Preço inválido para o produto ${row.key}.`);
  }
  if (!/^[A-Za-z]{3}$/.test(row.currency)) {
    throw new Error(`Moeda inválida para o produto ${row.key}.`);
  }

  return {
    key: row.key,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency.toLowerCase(),
    kind: row.kind,
    active: row.active,
    stripeLookupKey: row.stripe_lookup_key,
    contents,
    salePercentOff: activeSalePercent(row, Date.now()),
  };
}

export async function getServerStoreProduct(
  supabase: SupabaseClient<Database>,
  productKey: string,
  options: { activeOnly?: boolean } = {},
): Promise<ServerStoreProduct> {
  assertStoreProductKey(productKey);
  let query = supabase
    .from("store_products")
    .select(
      "key, name, description, price_cents, currency, kind, active, stripe_lookup_key, contents, sale_percent_off, sale_starts_at, sale_ends_at",
    )
    .eq("key", productKey);
  if (options.activeOnly !== false) query = query.eq("active", true);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Não foi possível validar o catálogo: ${error.message}`);
  if (!data) throw new Error("Este item não está disponível.");
  return parseProductRow(data as ProductRow);
}

/**
 * Stripe is queried from the server and must agree with the database-backed
 * catalog. A forged lookup key, changed price, or a stale client never reaches
 * a checkout session.
 */
export async function resolveValidatedStripePrice(
  stripe: Stripe,
  product: ServerStoreProduct,
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({
    lookup_keys: [product.stripeLookupKey],
    active: true,
    limit: 2,
  });
  const price = prices.data.find((candidate) => candidate.lookup_key === product.stripeLookupKey);
  if (!price) throw new Error("Preço de pagamento não encontrado para este item.");
  if (
    price.unit_amount !== product.priceCents ||
    price.currency.toLowerCase() !== product.currency
  ) {
    throw new Error("O preço do checkout não confere com o catálogo oficial.");
  }
  return price;
}

/** Promoção vale só entre início e fim; fora disso o preço cheio é cobrado. */
export function activeSalePercent(
  row: { sale_percent_off?: number | null; sale_starts_at?: string | null; sale_ends_at?: string | null },
  now: number,
): number {
  const pct = row.sale_percent_off ?? 0;
  if (!Number.isInteger(pct) || pct < 1 || pct > 90) return 0;
  if (row.sale_starts_at && now < Date.parse(row.sale_starts_at)) return 0;
  if (row.sale_ends_at && now > Date.parse(row.sale_ends_at)) return 0;
  return pct;
}

/**
 * Desconto aplicado pela própria Stripe via cupom com id fixo por porcentagem,
 * então o valor final é sempre calculado no servidor. Sem promoção, os clientes
 * podem digitar códigos promocionais criados na Stripe.
 */
export async function checkoutDiscountParams(
  stripe: Stripe,
  product: ServerStoreProduct,
): Promise<{ discounts: { coupon: string }[] } | { allow_promotion_codes: true }> {
  if (!product.salePercentOff) return { allow_promotion_codes: true };
  const id = `jm_sale_${product.salePercentOff}`;
  try {
    await stripe.coupons.retrieve(id);
  } catch {
    await stripe.coupons.create({
      id,
      percent_off: product.salePercentOff,
      duration: "once",
      name: `Promoção ${product.salePercentOff}%`,
    });
  }
  return { discounts: [{ coupon: id }] };
}
