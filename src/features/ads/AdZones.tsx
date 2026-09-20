import { Link } from "@tanstack/react-router";
import { Megaphone, Sparkles, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  recordAdMetric,
  selectAd,
  type AdCampaign,
  type AdContext,
  type AdPlacement,
} from "./ad-manager";

function useAd(context: AdContext, placement: AdPlacement) {
  const ad = useMemo(() => selectAd(context, placement), [context, placement]);
  useEffect(() => {
    if (ad) recordAdMetric(ad.id, placement, "impression");
  }, [ad, placement]);
  return ad;
}

function AdAction({ ad, placement }: { ad: AdCampaign; placement: AdPlacement }) {
  return (
    <Button asChild size="sm" className="shrink-0">
      <Link to={ad.href} onClick={() => recordAdMetric(ad.id, placement, "click")}>
        {ad.cta}
      </Link>
    </Button>
  );
}

export function NativeSponsoredCard({
  context,
  placement = "native",
  compact = false,
  className,
}: {
  context: AdContext;
  placement?: "native" | "feed";
  compact?: boolean;
  className?: string;
}) {
  const ad = useAd(context, placement);
  if (!ad) return null;
  return (
    <article className={cn("ad-native border border-primary/25 bg-primary/[0.055] p-4", className)} aria-label={ad.label}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-primary/12 text-primary">
          <Megaphone size={16} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{ad.label} · {ad.brand}</p>
          <h3 className="mt-1 font-display text-sm uppercase">{ad.title}</h3>
          {!compact ? <p className="mt-1 text-xs text-muted-foreground">{ad.body}</p> : null}
        </div>
        <AdAction ad={ad} placement={placement} />
      </div>
    </article>
  );
}

export function SidebarAd({ context }: { context: AdContext }) {
  const ad = useAd(context, "sidebar");
  if (!ad) return null;
  return (
    <aside className="ad-native border border-border/70 bg-card p-4" aria-label={ad.label}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{ad.label}</p>
      <Sparkles className="mt-4 text-primary" size={20} aria-hidden />
      <h2 className="mt-2 font-display text-base uppercase">{ad.title}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{ad.body}</p>
      <div className="mt-4"><AdAction ad={ad} placement="sidebar" /></div>
    </aside>
  );
}

export function CornerAd({ context, delayMs = 1200 }: { context: AdContext; delayMs?: number }) {
  const ad = useAd(context, "corner");
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ad) return;
    const show = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(show);
  }, [ad, delayMs]);
  useEffect(() => {
    if (!visible) return;
    const hide = window.setTimeout(() => setVisible(false), 9000);
    return () => window.clearTimeout(hide);
  }, [visible]);
  if (!ad || !visible) return null;
  return (
    <aside className="ad-corner fixed bottom-20 right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] border border-primary/30 bg-card p-4 shadow-xl md:bottom-5" aria-label={ad.label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Fechar anúncio"
        className="absolute right-1 top-1"
        onClick={() => {
          recordAdMetric(ad.id, "corner", "dismiss");
          setVisible(false);
        }}
      >
        <X size={16} aria-hidden />
      </Button>
      <p className="pr-9 text-[10px] font-bold uppercase tracking-widest text-primary/80">{ad.label}</p>
      <h2 className="mt-1 pr-8 font-display text-base uppercase">{ad.title}</h2>
      <p className="mt-2 text-xs text-muted-foreground">{ad.body}</p>
      <div className="mt-3"><AdAction ad={ad} placement="corner" /></div>
    </aside>
  );
}

export function SponsoredFeed({ context, itemCount }: { context: AdContext; itemCount: number }) {
  const interval = 3 + (itemCount % 3);
  return { interval, render: (index: number) => (index > 0 && index % interval === 0 ? <NativeSponsoredCard key={`ad-${index}`} context={context} placement="feed" /> : null) };
}

export function AdBetweenPosts({
  context,
  items,
  renderItem,
}: {
  context: AdContext;
  items: readonly unknown[];
  renderItem: (item: unknown, index: number) => ReactNode;
}) {
  const interval = 3 + (items.length % 3);
  return items.map((item, index) => (
    <Fragment key={index}>
      {index > 0 && index % interval === 0 ? (
        <NativeSponsoredCard context={context} placement="feed" />
      ) : null}
      {renderItem(item, index)}
    </Fragment>
  ));
}
