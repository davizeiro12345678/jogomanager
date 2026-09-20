import { useMemo } from "react";
import { BarChart3 } from "lucide-react";

import { getAdMetrics } from "./ad-manager";

export function AdMetricsPanel() {
  const rows = useMemo(() => {
    const all = getAdMetrics();
    const grouped = new Map<string, { impressions: number; clicks: number; dismissals: number }>();
    for (const metric of all) {
      const row = grouped.get(metric.campaignId) ?? { impressions: 0, clicks: 0, dismissals: 0 };
      if (metric.type === "impression") row.impressions++;
      if (metric.type === "click") row.clicks++;
      if (metric.type === "dismiss") row.dismissals++;
      grouped.set(metric.campaignId, row);
    }
    return [...grouped.entries()];
  }, []);

  return (
    <section className="ad-native border border-border/60 bg-card p-4">
      <div className="flex items-center gap-2"><BarChart3 size={16} className="text-primary" /><h2 className="font-display text-sm uppercase">Desempenho das recomendações</h2></div>
      {rows.length ? (
        <ul className="mt-3 space-y-2 text-xs">
          {rows.map(([id, row]) => (
            <li key={id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-border/50 pt-2">
              <span className="truncate">{id}</span>
              <span className="tabular text-muted-foreground">{row.impressions} exibições · {row.clicks} cliques · {row.dismissals} dispensas</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-muted-foreground">As métricas locais aparecerão após a primeira recomendação.</p>}
    </section>
  );
}
