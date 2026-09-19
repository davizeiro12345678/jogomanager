import { aiErrorMessage } from "@/lib/ai-error";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { GameShell } from "@/components/game/GameShell";
import { CLUBS } from "@/game/data/leagues";
import { computeTable, nextFixture } from "@/game/season";
import { useCareer } from "@/hooks/useCareer";
import type { CareerState, Player } from "@/game/types";
import {
  assistenteTatico,
  chatIA,
  coletiva,
  diretorEsportivo,
  jornalista,
  olheiro,
} from "@/lib/ai.functions";

export const Route = createFileRoute("/assistente")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Assistente de IA · Pro Football Manager 3D: Jogo de Futebol Manager Online" },
      {
        name: "description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      {
        property: "og:title",
        content: "Assistente de IA · Pro Football Manager 3D: Jogo de Futebol Manager Online",
      },
      {
        property: "og:description",
        content:
          "Monte seu elenco, defina táticas e assista aos 90 minutos em 3D. Jogo de manager de futebol online e grátis com clubes reais de 30+ ligas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Assistente de IA · Pro Football Manager 3D" },
      {
        name: "twitter:description",
        content: "O cérebro de IA da sua carreira: análises, notícias e táticas sob medida.",
      },
    ],
  }),
  component: AssistentePage,
});

/* ------------------------------------------------------------ cache por rodada */

type CacheKey = "diretor" | "olheiro" | "jornalista" | "tatico" | `coletiva:${string}`;

function cacheStorageKey(clubId: string, season: number, round: number, key: CacheKey) {
  return `pfm3d:ai:${clubId}:${season}:${round}:${key}`;
}

function readCache(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function writeCache(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore quota errors
  }
}

/* ------------------------------------------------------------ helpers de resumo */

function resumoJogadores(players: Record<string, Player>, lineup: string[]) {
  const all = Object.values(players).sort((a, b) => b.ovr - a.ovr);
  const titulares = new Set(lineup);
  // manda o elenco inteiro (titulares primeiro) para a IA não achar que o time só tem 11 jogadores
  const list = [
    ...all.filter((p) => titulares.has(p.id)),
    ...all.filter((p) => !titulares.has(p.id)),
  ];
  return list.slice(0, 26).map((p) => ({
    titular: titulares.has(p.id),
    nome: p.name,
    pos: p.pos,
    ovr: p.ovr,
    idade: p.age,
    moral: p.morale,
    forma: p.form,
    lesionado: p.injuryWeeks > 0,
  }));
}

/* ------------------------------------------------------------ UI genérica */

function ToolCard({
  title,
  description,
  result,
  loading,
  error,
  onGenerate,
  onRegenerate,
  disabled,
  children,
}: {
  title: string;
  description: string;
  result: string | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  onRegenerate: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 surface-card p-4">
      <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {children}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onGenerate}
          disabled={loading || disabled}
          className="rounded-lg bg-primary px-4 py-2 font-display text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Gerando…" : "Gerar"}
        </button>
        {result ? (
          <button
            onClick={onRegenerate}
            disabled={loading || disabled}
            className="rounded-lg border border-border/60 px-4 py-2 font-display text-xs uppercase tracking-wider disabled:opacity-50"
          >
            Gerar novamente
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {result ? (
        <p className="mt-3 whitespace-pre-line rounded-xl border border-border/40 bg-background/40 p-3 text-sm">
          {result}
        </p>
      ) : null}
    </section>
  );
}

function useCachedTool<TInput>(fn: (data: TInput) => Promise<string>, cacheKey: string) {
  const [result, setResult] = useState<string | null>(() => readCache(cacheKey));
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: (text) => {
      setResult(text);
      writeCache(cacheKey, text);
    },
  });

  return {
    result,
    loading: mutation.isPending,
    error: mutation.isError ? aiErrorMessage(mutation.error) : null,
    generate: (input: TInput) => mutation.mutate(input),
  };
}

/* ------------------------------------------------------------ página */

function AssistentePage() {
  const { career } = useCareer();
  if (!career) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Nenhuma carreira ativa.
      </div>
    );
  }
  return (
    <GameShell career={career}>
      <AssistenteContent career={career} />
    </GameShell>
  );
}

function AssistenteContent({ career }: { career: CareerState }) {
  const club = CLUBS[career.clubId];
  const table = useMemo(() => computeTable(career), [career]);
  const posicaoAtual = useMemo(
    () => Math.max(1, table.findIndex((r) => r.clubId === career.clubId) + 1),
    [table, career.clubId],
  );
  const fixture = nextFixture(career);
  const opponentId = fixture
    ? fixture.home === career.clubId
      ? fixture.away
      : fixture.home
    : undefined;
  const opponent = opponentId ? CLUBS[opponentId] : undefined;

  const diretorFn = useServerFn(diretorEsportivo);
  const olheiroFn = useServerFn(olheiro);
  const jornalistaFn = useServerFn(jornalista);
  const taticoFn = useServerFn(assistenteTatico);
  const coletivaFn = useServerFn(coletiva);
  const chatFn = useServerFn(chatIA);

  const diretor = useCachedTool(
    async () =>
      diretorFn({
        data: {
          clube: club?.name ?? career.clubId,
          formacao: career.tactics.formation,
          objetivo: career.objective,
          posicaoAtual,
          orcamento: career.finances.budget,
          jogadores: resumoJogadores(career.players, career.lineup),
        },
      }),
    cacheStorageKey(career.clubId, career.season, career.round, "diretor"),
  );

  const olheiroAlvos = useMemo(
    () =>
      career.scoutReports.slice(0, 12).map((r) => ({
        nome: r.name,
        pos: r.pos,
        ovr: r.ovr,
        potencial: r.potential,
        idade: r.age,
        valor: r.value,
        clube: CLUBS[r.clubId]?.name ?? r.clubId,
      })),
    [career.scoutReports],
  );
  const olheiroTool = useCachedTool(
    async () => olheiroFn({ data: { alvos: olheiroAlvos } }),
    cacheStorageKey(career.clubId, career.season, career.round, "olheiro"),
  );

  const jornalistaTool = useCachedTool(
    async () =>
      jornalistaFn({
        data: {
          clube: club?.name ?? career.clubId,
          temporada: career.season,
          rodada: career.round,
          posicaoTabela: posicaoAtual,
          pontos: table.find((r) => r.clubId === career.clubId)?.pts ?? 0,
          sequencia: career.streak,
          ultimoResultado: career.results.at(-1)
            ? `${career.results.at(-1)!.hg} x ${career.results.at(-1)!.ag}`
            : undefined,
        },
      }),
    cacheStorageKey(career.clubId, career.season, career.round, "jornalista"),
  );

  const taticoTool = useCachedTool(
    async () =>
      taticoFn({
        data: {
          clube: club?.name ?? career.clubId,
          formacaoAtual: career.tactics.formation,
          mandante: fixture ? fixture.home === career.clubId : true,
          adversario: { nome: opponent?.name ?? "adversário", forca: opponent?.strength ?? 70 },
          elencoResumo: resumoJogadores(career.players, career.lineup)
            .map((p) => `${p.nome} (${p.pos}, ${p.ovr})`)
            .join(", "),
        },
      }),
    cacheStorageKey(career.clubId, career.season, career.round, "tatico"),
  );

  const [pergunta, setPergunta] = useState("");
  const coletivaTool = useCachedTool(
    async (input: { pergunta: string }) =>
      coletivaFn({
        data: {
          personalidade: career.manager?.personality ?? "profissional",
          pergunta: input.pergunta,
          contexto: {
            clube: club?.name ?? career.clubId,
            posicaoTabela: posicaoAtual,
            resultadoRecente: career.results.at(-1)
              ? `${career.results.at(-1)!.hg} x ${career.results.at(-1)!.ag}`
              : undefined,
          },
        },
      }),
    cacheStorageKey(career.clubId, career.season, career.round, `coletiva:${pergunta}`),
  );

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const chatMutation = useMutation({
    mutationFn: async (nextMessages: { role: "user" | "assistant"; text: string }[]) =>
      chatFn({
        data: {
          resumoCarreira: `${club?.name ?? career.clubId}, temporada ${career.season}, rodada ${career.round}, posição ${posicaoAtual}, orçamento ${career.finances.budget}M€, pressão ${career.pressure}%, aprovação ${career.approval}%, sequência ${career.streak}, formação ${career.tactics.formation}, próximo rival ${opponent?.name ?? "a definir"}, força rival ${opponent?.strength ?? "desconhecida"}, último placar ${career.results.at(-1) ? `${career.results.at(-1)!.hg} x ${career.results.at(-1)!.ag}` : "sem jogo"}.`,
          mensagens: nextMessages.slice(-10),
        },
      }),
  });

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setChatInput("");
    chatMutation.mutate(next, {
      onSuccess: (answer) => {
        setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
      },
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl uppercase tracking-wide">Assistente de IA</h1>
      <p className="text-sm text-muted-foreground">
        Ferramentas com inteligência artificial para ajudar na gestão do {club?.name ?? "clube"}.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <ToolCard
          title="Diretor esportivo"
          description="Analisa o elenco e aponta pontos fracos e prioridades de mercado."
          result={diretor.result}
          loading={diretor.loading}
          error={diretor.error}
          onGenerate={() => diretor.generate(undefined as never)}
          onRegenerate={() => diretor.generate(undefined as never)}
        />

        <ToolCard
          title="Olheiro"
          description="Sugere quais alvos escoutados valem a pena, com base nos relatórios."
          result={olheiroTool.result}
          loading={olheiroTool.loading}
          error={olheiroTool.error}
          disabled={olheiroAlvos.length === 0}
          onGenerate={() => olheiroTool.generate(undefined as never)}
          onRegenerate={() => olheiroTool.generate(undefined as never)}
        >
          {olheiroAlvos.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nenhum relatório de olheiro ainda. Envie olheiros em "Scouting" primeiro.
            </p>
          ) : null}
        </ToolCard>

        <ToolCard
          title="Jornalista"
          description="Escreve a notícia da rodada/temporada sobre o clube."
          result={jornalistaTool.result}
          loading={jornalistaTool.loading}
          error={jornalistaTool.error}
          onGenerate={() => jornalistaTool.generate(undefined as never)}
          onRegenerate={() => jornalistaTool.generate(undefined as never)}
        />

        <ToolCard
          title="Assistente tático"
          description="Sugere formação e instruções para o próximo adversário."
          result={taticoTool.result}
          loading={taticoTool.loading}
          error={taticoTool.error}
          disabled={!opponent}
          onGenerate={() => taticoTool.generate(undefined as never)}
          onRegenerate={() => taticoTool.generate(undefined as never)}
        >
          {opponent ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Próximo jogo: {fixture?.home === career.clubId ? "em casa" : "fora"} contra{" "}
              {opponent.name}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Nenhum jogo agendado.</p>
          )}
        </ToolCard>
      </div>

      <section className="rounded-2xl border border-border/60 surface-card p-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Coletiva de imprensa
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Faça uma pergunta de jornalista e receba a resposta com a personalidade do treinador.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder="Ex.: Treinador, o senhor teme demissão?"
            className="flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => coletivaTool.generate({ pergunta })}
            disabled={coletivaTool.loading || !pergunta.trim()}
            className="rounded-lg bg-primary px-4 py-2 font-display text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {coletivaTool.loading ? "Respondendo…" : "Perguntar"}
          </button>
          {coletivaTool.result ? (
            <button
              onClick={() => coletivaTool.generate({ pergunta })}
              disabled={coletivaTool.loading}
              className="rounded-lg border border-border/60 px-4 py-2 font-display text-xs uppercase tracking-wider disabled:opacity-50"
            >
              Gerar novamente
            </button>
          ) : null}
        </div>
        {coletivaTool.error ? (
          <p className="mt-3 text-sm text-destructive">{coletivaTool.error}</p>
        ) : null}
        {coletivaTool.result ? (
          <p className="mt-3 whitespace-pre-line rounded-xl border border-border/40 bg-background/40 p-3 text-sm">
            {coletivaTool.result}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border/60 surface-card p-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Chat com o assistente
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Converse livremente sobre a sua carreira.
        </p>
        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border/40 bg-background/40 p-3">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma mensagem ainda.</p>
          ) : (
            messages.map((m, i) => (
              <p
                key={i}
                className={`text-sm ${m.role === "user" ? "text-foreground" : "text-primary"}`}
              >
                <span className="font-medium">{m.role === "user" ? "Você" : "Assistente"}: </span>
                {m.text}
              </p>
            ))
          )}
          {chatMutation.isPending ? (
            <p className="text-xs text-muted-foreground">Assistente está digitando…</p>
          ) : null}
          {chatMutation.isError ? (
            <p className="text-sm text-destructive">{aiErrorMessage(chatMutation.error)}</p>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendChat();
            }}
            placeholder="Pergunte algo sobre sua carreira…"
            className="flex-1 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm"
          />
          <button
            onClick={sendChat}
            disabled={chatMutation.isPending || !chatInput.trim()}
            className="rounded-lg bg-primary px-4 py-2 font-display text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </section>
    </div>
  );
}
