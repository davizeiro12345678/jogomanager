import type { ReactNode } from "react";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { DISCORD_INVITE } from "@/content/community";

/** The shared link must not pull the full community section into public startup. */
export function DiscordLink({
  children = "Entrar no Discord",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={DISCORD_INVITE}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#5865f2] px-5 py-3 font-display text-sm text-white transition hover:bg-[#4752c4] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary ${className}`}
    >
      <MessageCircle size={18} aria-hidden="true" />
      {children}
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
