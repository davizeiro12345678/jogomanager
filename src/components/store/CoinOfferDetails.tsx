import { formatCoinOfferRate, type CoinOfferValue } from "@/game/store-offers";

export function CoinOfferDetails({
  value,
  betterOffer,
  anchorPrefix = "store-product-",
}: {
  value?: CoinOfferValue | undefined;
  betterOffer?: { key: string; name: string; coins: number } | undefined;
  anchorPrefix?: string;
}) {
  if (!value) return null;
  return (
    <div className="basis-full space-y-1 text-xs text-muted-foreground">
      <p>{formatCoinOfferRate(value)}</p>
      {betterOffer ? (
        <p>
          Compare:{" "}
          <a className="text-primary underline" href={`#${anchorPrefix}${betterOffer.key}`}>
            {betterOffer.name}
          </a>{" "}
          oferece {betterOffer.coins.toLocaleString("pt-BR")} moedas por preço igual ou menor.
        </p>
      ) : null}
    </div>
  );
}
