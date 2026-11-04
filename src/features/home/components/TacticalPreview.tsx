import { useState } from "react";
import styles from "./TacticalPreview.module.css";

const FORMATIONS = {
  "4-3-3": [
    [50, 87],
    [15, 68],
    [38, 72],
    [62, 72],
    [85, 68],
    [50, 52],
    [30, 40],
    [70, 40],
    [17, 20],
    [50, 14],
    [83, 20],
  ],
  "4-4-2": [
    [50, 87],
    [15, 69],
    [38, 73],
    [62, 73],
    [85, 69],
    [16, 42],
    [38, 48],
    [62, 48],
    [84, 42],
    [36, 19],
    [64, 19],
  ],
  "3-5-2": [
    [50, 87],
    [26, 70],
    [50, 75],
    [74, 70],
    [10, 40],
    [35, 47],
    [50, 53],
    [65, 47],
    [90, 40],
    [36, 19],
    [64, 19],
  ],
} as const;
type Formation = keyof typeof FORMATIONS;

/** A lightweight SVG teaches the interaction; the actual 3D engine loads
 * through the game routes only. No league catalogue, simulation or Canvas. */
export function TacticalPreview() {
  const [formation, setFormation] = useState<Formation>("4-3-3");
  return (
    <div className={styles["tactics"]} aria-label="Prévia das formações">
      <div className={styles["top"]}>
        <span>PRANCHETA DO TREINADOR</span>
        <span>PRÉVIA</span>
      </div>
      <svg viewBox="0 0 240 300" role="img" aria-label={`Onze jogadores na formação ${formation}`}>
        <defs>
          <pattern id="home-mow" width="240" height="50" patternUnits="userSpaceOnUse">
            <rect width="240" height="25" fill="#17382c" />
            <rect y="25" width="240" height="25" fill="#1a3e30" />
          </pattern>
        </defs>
        <rect x="8" y="8" width="224" height="284" rx="5" fill="url(#home-mow)" />
        <g fill="none" stroke="#b6d2bd" strokeOpacity=".35" strokeWidth="1.2">
          <rect x="19" y="18" width="202" height="264" />
          <path d="M19 150h202M69 18v42h102V18M69 282v-42h102v42M97 18v15h46V18M97 282v-15h46v15" />
          <circle cx="120" cy="150" r="28" />
          <circle cx="120" cy="150" r="2" fill="#b6d2bd" />
        </g>
        {FORMATIONS[formation].map(([x, y], i) => (
          <g
            key={i}
            className={styles["player"]}
            style={{ transform: `translate(${x * 2 + 20}px,${y * 2.64 + 18}px)` }}
          >
            <circle
              r="12"
              fill={i === 0 ? "#d9b967" : "#b4ec6b"}
              stroke="#081510"
              strokeWidth="3"
            />
            <text
              y="3.5"
              textAnchor="middle"
              fontSize="10"
              fontFamily="sans-serif"
              fontWeight="700"
              fill="#102416"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles["formations"]} role="group" aria-label="Experimentar formação">
        {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={formation === f}
            onClick={() => setFormation(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <p className={styles["caption"]}>Mude o desenho. Imagine a próxima jogada.</p>
    </div>
  );
}
