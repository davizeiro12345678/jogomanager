export interface StoreSale {
  price_cents: number;
  sale_percent_off?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
}

/** A malformed sale must never advertise or charge a discount. Shared by both sides. */
export function salePrice(p: StoreSale, now = Date.now()): { cents: number; percent: number } {
  const percent = p.sale_percent_off ?? 0;
  const start = p.sale_starts_at ? Date.parse(p.sale_starts_at) : -Infinity;
  const end = p.sale_ends_at ? Date.parse(p.sale_ends_at) : Infinity;
  const live =
    Number.isInteger(percent) &&
    percent > 0 &&
    percent <= 90 &&
    !Number.isNaN(start) &&
    !Number.isNaN(end) &&
    start <= end &&
    now >= start &&
    now <= end;
  return live
    ? { cents: Math.round(p.price_cents * (1 - percent / 100)), percent }
    : { cents: p.price_cents, percent: 0 };
}

export interface CoinOfferProduct extends StoreSale {
  key: string;
  kind: string;
  coins: number;
  currency: string;
}

export interface CoinOfferValue {
  cents: number;
  currency: string;
  coinsPerUnit: number;
  isBestValue: boolean;
  /** A strictly cheaper/equal-price offer with at least as many coins. */
  betterOfferKey: string | null;
}

/** No exchange-rate guess, subscription benefit, static bonus or rounded-rate ranking. */
export function compareCoinOffers(
  products: readonly CoinOfferProduct[],
  now = Date.now(),
): Map<string, CoinOfferValue> {
  const offers = products.flatMap((product) => {
    const cents = salePrice(product, now).cents;
    const currency = product.currency.toUpperCase();
    return product.kind === "coins" &&
      Number.isSafeInteger(product.coins) &&
      product.coins > 0 &&
      Number.isSafeInteger(cents) &&
      cents > 0 &&
      /^[A-Z]{3}$/.test(currency)
      ? [{ key: product.key, coins: product.coins, cents, currency }]
      : [];
  });
  const compareRate = (a: (typeof offers)[number], b: (typeof offers)[number]) => {
    const difference = BigInt(a.coins) * BigInt(b.cents) - BigInt(b.coins) * BigInt(a.cents);
    return difference > 0n ? 1 : difference < 0n ? -1 : 0;
  };
  return new Map(
    offers.map((offer) => {
      const peers = offers.filter((other) => other.currency === offer.currency);
      const better = peers
        .filter(
          (other) =>
            other.key !== offer.key &&
            other.cents <= offer.cents &&
            other.coins >= offer.coins &&
            (other.cents < offer.cents || other.coins > offer.coins),
        )
        .sort((a, b) => compareRate(b, a) || a.cents - b.cents || a.key.localeCompare(b.key))[0];
      return [
        offer.key,
        {
          cents: offer.cents,
          currency: offer.currency,
          coinsPerUnit: (offer.coins * 100) / offer.cents,
          isBestValue: peers.length > 1 && peers.every((other) => compareRate(offer, other) >= 0),
          betterOfferKey: better?.key ?? null,
        },
      ];
    }),
  );
}

export function formatCoinOfferRate(value: CoinOfferValue): string {
  const unit = value.currency === "BRL" ? "R$" : value.currency;
  return `${value.coinsPerUnit.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} moedas/${unit}`;
}

/** Coin-card claims always reflect the current quantity, even after catalog changes. */
export function storeProductDescription(product: {
  kind: string;
  coins: number;
  description: string;
}): string {
  return product.kind === "coins" && Number.isSafeInteger(product.coins) && product.coins > 0
    ? `${product.coins.toLocaleString("pt-BR")} moedas para os itens disponíveis no jogo. Compare abaixo a quantidade por unidade de preço.`
    : product.description;
}
