import { Link } from "@tanstack/react-router";

/** Mobile-only fixed call to action for public content pages. */
export function StickyPlayCta({ label = "Jogar grátis agora" }: { label?: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 p-3 backdrop-blur sm:hidden">
      <Link
        to="/new"
        className="block rounded-lg bg-primary py-3 text-center font-display text-sm uppercase tracking-widest text-primary-foreground"
      >
        {label}
      </Link>
    </div>
  );
}
