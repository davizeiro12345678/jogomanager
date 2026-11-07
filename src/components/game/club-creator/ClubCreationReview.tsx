import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEAGUES } from "@/game/data/leagues";
import type { MyClub } from "@/lib/myClub";
import {
  SHAPE_LABEL,
  CREST_PATTERN_LABEL,
  EMBLEM_LABEL,
  KIT_PATTERN_LABEL,
} from "@/game/crest-options";
export function ClubCreationReview({
  club,
  managerName,
  personality,
  reputation,
  onEdit,
}: {
  club: MyClub;
  managerName: string;
  personality: string;
  reputation: number;
  onEdit: (step: number) => void;
}) {
  const league = LEAGUES.find((item) => item.id === club.leagueId);
  const rows = [
    {
      label: "Treinador e liga",
      value: `${managerName.trim() || "Técnico"} · ${personality} · reputação ${reputation} · ${league?.name ?? club.leagueId}`,
      step: 0,
    },
    {
      label: "Identidade",
      value: `${club.name || "Seu Clube"} · ${club.short} · ${club.city || "Cidade"} · ${club.founded}`,
      step: 0,
    },
    {
      label: "Escudo",
      value: `${SHAPE_LABEL[club.crest.shape]} · ${CREST_PATTERN_LABEL[club.crest.pattern]} · ${EMBLEM_LABEL[club.crest.emblem]}`,
      step: 1,
    },
    { label: "Uniforme", value: KIT_PATTERN_LABEL[club.kit.pattern], step: 2 },
    {
      label: "Estádio",
      value: `${club.stadium.name} · ${club.stadium.capacity.toLocaleString("pt-BR")} lugares · ${{ aberto: "Sem cobertura", parcial: "Cobertura parcial", total: "Arena fechada" }[club.stadium.roof]}`,
      step: 3,
    },
  ];
  return (
    <section className="creation-review" aria-labelledby="club-review-title">
      <h2 id="club-review-title" className="font-display text-lg">
        Revisão antes de fundar
      </h2>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <div>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Editar ${row.label.toLowerCase()}`}
              title={`Editar ${row.label.toLowerCase()}`}
              onClick={() => onEdit(row.step)}
            >
              <Pencil size={16} />
            </Button>
          </div>
        ))}
      </dl>
    </section>
  );
}
