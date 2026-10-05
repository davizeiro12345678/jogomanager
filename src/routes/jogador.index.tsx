import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crest } from "@/components/game/Crest";
import { CLUBS } from "@/game/data/leagues";
import { POSITION_LABEL } from "@/game/player-career/attributes";
import { overall } from "@/game/player-career/engine";
import { useAthleteSlots } from "@/hooks/useAthlete";
import "@/components/game/athlete.css";

export const Route = createFileRoute("/jogador/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Carreira de jogador — Football Manager 3D" },
      { name: "description", content: "Crie seu atleta, evolua da base ao auge e escreva sua história no futebol." },
      { property: "og:title", content: "Carreira de jogador — Football Manager 3D" },
      { property: "og:description", content: "Da base à aposentadoria: treinos, contratos, seleção e prêmios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AthleteHub,
});

function AthleteHub() {
  const { slots, error, remove, signedIn } = useAthleteSlots();
  return (
    <main className="athlete-shell">
      <div className="athlete-wrap">
        <div className="athlete-top">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" /> Início</Link></Button>
          <span className="athlete-meta">{signedIn ? "Salvo no aparelho e na sua conta" : "Salvo neste aparelho"}</span>
        </div>
        <header>
          <h1 className="text-3xl font-bold">Carreira de jogador</h1>
          <p className="athlete-meta">Você é o atleta. Treine, conquiste a vaga, negocie contratos e chegue à seleção. Até 3 atletas.</p>
        </header>
        {error && <p className="athlete-card athlete-meta" role="alert">{error}</p>}
        {!slots ? (
          <p className="athlete-meta">Carregando…</p>
        ) : (
          <div className="athlete-slots">
            {slots.map((s, i) => {
              const slot = (i + 1) as 1 | 2 | 3;
              if (!s)
                return (
                  <div key={slot} className="athlete-card grid gap-3 place-items-center text-center py-8">
                    <p className="athlete-meta">Espaço {slot} vazio</p>
                    <Button asChild size="lg"><Link to="/jogador/novo" search={{ slot }}><Plus className="size-4" /> Criar atleta</Link></Button>
                  </div>
                );
              const club = CLUBS[s.clubId];
              return (
                <div key={slot} className="athlete-card grid gap-3" style={{ ["--club" as string]: club?.primary }}>
                  <div className="flex items-center gap-3">
                    {club && <Crest club={club} size={44} />}
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold truncate">{s.nickname}</h2>
                      <p className="athlete-meta truncate">{POSITION_LABEL[s.position]} · {s.age} anos · {club?.name ?? "Sem clube"}</p>
                    </div>
                    <div className="athlete-ovr ml-auto" style={{ width: "3.2rem", height: "3.2rem", fontSize: "1.3rem" }}>{overall(s)}</div>
                  </div>
                  <p className="athlete-meta">{s.retired ? "Aposentado" : `Temporada ${s.season} · semana ${s.week}`}</p>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1"><Link to="/jogador/painel" search={{ slot }}>{s.retired ? "Ver legado" : "Continuar"}</Link></Button>
                    <Button variant="outline" size="icon" aria-label={`Excluir ${s.nickname}`} onClick={() => { if (window.confirm(`Excluir ${s.nickname}? Não dá para desfazer.`)) void remove(slot); }}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
