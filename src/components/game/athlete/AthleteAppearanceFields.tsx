import { Button } from "@/components/ui/button";
const SKINS = ["#f4d3b5", "#e2b48c", "#c68a5d", "#a0673f", "#7a4a2a", "#4e2e1a"];

const HAIR_COLORS = ["#1b1410", "#4a2f1d", "#8a5a2b", "#d8b46a", "#b5b5b5"];

const HAIR_STYLES = [
  "Raspado",
  "Degradê",
  "Curto",
  "Cacheado",
  "Black",
  "Tranças",
  "Coque",
  "Moicano",
  "Ondulado",
  "Longo",
];

export function AthleteAppearanceFields({
  skin,
  hair,
  hairColor,
  beard,
  shirt,
  setSkin,
  setHair,
  setHairColor,
  setBeard,
  setShirt,
}: {
  skin: number;
  hair: number;
  hairColor: number;
  beard: number;
  shirt: number;
  setSkin: (value: number) => void;
  setHair: (value: number) => void;
  setHairColor: (value: number) => void;
  setBeard: (value: number) => void;
  setShirt: (value: number) => void;
}) {
  return (
    <>
      {" "}
      <div className="athlete-field">
        <span>Tom de pele</span>
        <div className="athlete-chips">
          {SKINS.map((c, i) => (
            <Button
              key={c}
              type="button"
              variant="outline"
              size="icon"
              className="athlete-swatch"
              aria-label={`Tom ${i + 1}`}
              aria-pressed={skin === i}
              style={{ background: c }}
              onClick={() => setSkin(i)}
            />
          ))}
        </div>
      </div>
      <label className="athlete-field">
        <span>Cabelo</span>
        <select value={hair} onChange={(e) => setHair(Number(e.target.value))}>
          {HAIR_STYLES.map((h, i) => (
            <option key={h} value={i}>
              {h}
            </option>
          ))}
        </select>
      </label>
      <div className="athlete-field">
        <span>Cor do cabelo</span>
        <div className="athlete-chips">
          {HAIR_COLORS.map((c, i) => (
            <Button
              key={c}
              type="button"
              variant="outline"
              size="icon"
              className="athlete-swatch"
              aria-label={`Cor ${i + 1}`}
              aria-pressed={hairColor === i}
              style={{ background: c }}
              onClick={() => setHairColor(i)}
            />
          ))}
        </div>
      </div>
      <label className="athlete-field">
        <span>Barba</span>
        <select value={beard} onChange={(e) => setBeard(Number(e.target.value))}>
          {["Sem barba", "Rala", "Média", "Cheia"].map((b, i) => (
            <option key={b} value={i}>
              {b}
            </option>
          ))}
        </select>
      </label>
      <label className="athlete-field">
        <span>Número da camisa</span>
        <input
          type="number"
          min={1}
          max={99}
          value={shirt}
          onChange={(e) => setShirt(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
        />
      </label>
    </>
  );
}
