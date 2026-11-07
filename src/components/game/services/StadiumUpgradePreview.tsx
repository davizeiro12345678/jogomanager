import { applyStadiumUpgrade, canUpgradeStadium } from "@/game/coin-services";
import type { CareerState } from "@/game/types";
import { STADIUM_UPGRADE_MAX_LEVEL } from "@/lib/wallet-rules";

export function StadiumUpgradePreview({ career }: { career: CareerState }) {
  const level = career.stadiumUpgrades ?? 0;
  const canUpgrade = canUpgradeStadium(career);
  const nextCapacity = canUpgrade ? applyStadiumUpgrade(career).capacity : career.capacity;
  return (
    <div className="my-3 border-y border-border py-3">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
        <strong>
          Nível {level} de {STADIUM_UPGRADE_MAX_LEVEL}
        </strong>
        <span className="text-muted-foreground">
          {canUpgrade ? "Expansão disponível" : "Todas as ampliações concluídas"}
        </span>
      </div>
      <progress
        value={level}
        max={STADIUM_UPGRADE_MAX_LEVEL}
        aria-label="Ampliações do estádio concluídas"
        className="h-2 w-full accent-primary"
      />
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Capacidade atual</dt>
          <dd className="font-display text-lg">
            {career.capacity.toLocaleString("pt-BR")} lugares
          </dd>
        </div>
        {canUpgrade && (
          <div>
            <dt className="text-muted-foreground">Após ampliação</dt>
            <dd className="font-display text-lg text-primary">
              {nextCapacity.toLocaleString("pt-BR")} lugares
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
