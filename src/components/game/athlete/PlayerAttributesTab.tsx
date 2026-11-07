import { ATTRIBUTES, GROUP_LABEL, keyAttributes, TRAITS } from "@/game/player-career/attributes";
import type { AttributeGroup, PlayerCareerState } from "@/game/player-career/types";
export function PlayerAttributesTab({ state }: { state: PlayerCareerState }) {
  const groups: AttributeGroup[] =
    state.position === "GOL"
      ? ["goleiro", "mental", "fisico", "tecnico", "defensivo"]
      : ["tecnico", "fisico", "mental", "defensivo"];
  const groupAvg = (group: AttributeGroup) => {
    const list = ATTRIBUTES.filter((item) => item.group === group);
    return Math.round(
      list.reduce((sum, item) => sum + (state.attrs[item.key] ?? 0), 0) / list.length,
    );
  };
  return (
    <section className="athlete-card grid gap-4">
      {groups.map((g) => (
        <div key={g}>
          <h2 className="font-bold mb-2">
            {GROUP_LABEL[g]} <span className="athlete-meta">· média {groupAvg(g)}</span>
          </h2>
          <div className="athlete-attrs">
            {ATTRIBUTES.filter((a) => a.group === g).map((a) => {
              const v = Math.round(state.attrs[a.key] ?? 0);
              const key = keyAttributes(state.position).slice(0, 5).includes(a.key);
              return (
                <div key={a.key} className="athlete-attr">
                  <span>
                    {a.label}
                    {key ? " ★" : ""}
                  </span>
                  <b className={v >= 75 ? "hi" : v < 45 ? "lo" : ""}>{v}</b>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div>
        <h2 className="font-bold mb-2">Características</h2>
        <div className="athlete-chips">
          {TRAITS.map((t) => (
            <span
              key={t.key}
              className="athlete-chip"
              data-active={state.traits.includes(t.key)}
              title={t.hint}
              style={{ opacity: state.traits.includes(t.key) ? 1 : 0.45 }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <p className="athlete-meta mt-2">Características apagadas ainda não foram conquistadas.</p>
      </div>
    </section>
  );
}
