import { Users } from "lucide-react";
import { DiscordLink } from "./DiscordLink";

export { DiscordLink } from "./DiscordLink";

// Only the full community section needs this editorial copy.
const COMMUNITY_TOPICS = [
  {
    title: "Encontre sua próxima rivalidade",
    text: "Conheça outros treinadores, combine partidas e compartilhe o código da sua sala.",
  },
  {
    title: "Troque ideias de futebol",
    text: "Converse sobre formações, contratações e os desafios da sua carreira.",
  },
  {
    title: "Ajude a construir o jogo",
    text: "Compartilhe sugestões, relate problemas e acompanhe as conversas sobre novidades.",
  },
] as const;

export function CommunityInvite({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="Comunidade no Discord"
      className="relative mt-10 overflow-hidden rounded-2xl border border-[#5865f2]/45 bg-gradient-to-br from-[#5865f2]/20 via-card to-card p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 font-display text-xs uppercase tracking-widest text-foreground">
            <Users size={16} aria-hidden="true" /> O futebol fica melhor com a comunidade
          </p>
          <h2 className={`mt-3 font-display ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
            Seu próximo rival. Sua próxima grande ideia.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Entre no nosso servidor do Discord, encontre outros managers, troque táticas e mostre a
            história do seu clube. A conversa continua depois do apito final.
          </p>
        </div>
        <DiscordLink className="w-full shrink-0 sm:w-auto">Fazer parte da comunidade</DiscordLink>
      </div>
      {!compact && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {COMMUNITY_TOPICS.map((topic) => (
            <div
              key={topic.title}
              className="rounded-xl border border-white/10 bg-background/35 p-4"
            >
              <h3 className="font-display text-base">{topic.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{topic.text}</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-5 text-xs text-muted-foreground">
        O convite abre o Discord em uma nova aba. Respeite os outros jogadores e compartilhe apenas
        informações que você deseja tornar públicas.
      </p>
    </section>
  );
}
