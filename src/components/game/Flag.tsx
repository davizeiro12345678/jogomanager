import { useId } from "react";

type Spec =
  | { t: "v"; c: [string, string, string] }
  | { t: "h"; c: [string, string, string] }
  | { t: "h2"; c: [string, string] }
  | { t: "nordic"; bg: string; cross: string; inner?: string }
  | { t: "custom"; key: string };

const LEAGUE_COUNTRY: Record<string, string> = {
  bra: "bra",
  bra2: "bra",
  eng: "eng",
  eng2: "eng",
  esp: "esp",
  esp2: "esp",
  ita: "ita",
  ita2: "ita",
  ger: "ger",
  ger2: "ger",
  fra: "fra",
  fra2: "fra",
};

const FLAGS: Record<string, Spec> = {
  bra: { t: "custom", key: "bra" },
  eng: { t: "custom", key: "cross-en" },
  sco: { t: "custom", key: "saltire" },
  esp: { t: "custom", key: "esp" },
  ita: { t: "v", c: ["#009246", "#ffffff", "#ce2b37"] },
  ger: { t: "h", c: ["#000000", "#dd0000", "#ffce00"] },
  fra: { t: "v", c: ["#0055a4", "#ffffff", "#ef4135"] },
  por: { t: "custom", key: "por" },
  ned: { t: "h", c: ["#ae1c28", "#ffffff", "#21468b"] },
  bel: { t: "v", c: ["#000000", "#fdda24", "#ef3340"] },
  tur: { t: "custom", key: "crescent-red" },
  arg: { t: "h", c: ["#75aadb", "#ffffff", "#75aadb"] },
  mex: { t: "v", c: ["#006847", "#ffffff", "#ce1126"] },
  usa: { t: "custom", key: "usa" },
  sau: { t: "h2", c: ["#006c35", "#006c35"] },
  jpn: { t: "custom", key: "sun" },
  gre: { t: "custom", key: "gre" },
  sui: { t: "custom", key: "cross-ch" },
  aut: { t: "h", c: ["#ed2939", "#ffffff", "#ed2939"] },
  den: { t: "nordic", bg: "#c8102e", cross: "#ffffff" },
  nor: { t: "nordic", bg: "#ba0c2f", cross: "#ffffff", inner: "#00205b" },
  swe: { t: "nordic", bg: "#006aa7", cross: "#fecc02" },
  pol: { t: "h2", c: ["#ffffff", "#dc143c"] },
  ukr: { t: "h2", c: ["#0057b7", "#ffd700"] },
  chi: { t: "custom", key: "chi" },
  col: { t: "custom", key: "col" },
  uru: { t: "custom", key: "uru" },
  aus: { t: "custom", key: "aus" },
  kor: { t: "custom", key: "kor" },
  egy: { t: "h", c: ["#ce1126", "#ffffff", "#000000"] },
  hrv: { t: "h", c: ["#ff0000", "#ffffff", "#171796"] },
  srb: { t: "h", c: ["#c6363c", "#0c4076", "#ffffff"] },
  cze: { t: "custom", key: "cze" },
  rou: { t: "v", c: ["#002b7f", "#fcd116", "#ce1126"] },
  per: { t: "v", c: ["#d91023", "#ffffff", "#d91023"] },
  ecu: { t: "h", c: ["#ffdd00", "#0072ce", "#ef3340"] },
  par: { t: "h", c: ["#d52b1e", "#ffffff", "#0038a8"] },
  bol: { t: "h", c: ["#d52b1e", "#f9e300", "#007a33"] },
  nga: { t: "v", c: ["#008751", "#ffffff", "#008751"] },
  rsa: { t: "custom", key: "rsa" },
  mar: { t: "custom", key: "mar" },
  qat: { t: "custom", key: "qat" },
  uae: { t: "custom", key: "uae" },
  tha: { t: "custom", key: "tha" },
  idn: { t: "h2", c: ["#ce1126", "#ffffff"] },
  can: { t: "custom", key: "can" },
};

function Custom({ k }: { k: string }) {
  switch (k) {
    case "bra":
      return (
        <>
          <rect width="24" height="16" fill="#009b3a" />
          <path d="M12 1.6 L22.6 8 L12 14.4 L1.4 8 Z" fill="#fedf00" />
          <circle cx="12" cy="8" r="3.4" fill="#002776" />
          <path d="M8.7 7.2 A5 5 0 0 1 15.3 7.6" stroke="#ffffff" strokeWidth="0.9" fill="none" />
        </>
      );
    case "cross-en":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect x="10" width="4" height="16" fill="#ce1124" />
          <rect y="6" width="24" height="4" fill="#ce1124" />
        </>
      );
    case "saltire":
      return (
        <>
          <rect width="24" height="16" fill="#005eb8" />
          <path d="M0 0 L24 16 M24 0 L0 16" stroke="#ffffff" strokeWidth="3.2" />
        </>
      );
    case "esp":
      return (
        <>
          <rect width="24" height="16" fill="#aa151b" />
          <rect y="4" width="24" height="8" fill="#f1bf00" />
          <rect x="4.5" y="6" width="3" height="4" rx="0.4" fill="#aa151b" opacity="0.85" />
        </>
      );
    case "por":
      return (
        <>
          <rect width="24" height="16" fill="#da291c" />
          <rect width="9.6" height="16" fill="#046a38" />
          <circle cx="9.6" cy="8" r="3" fill="#ffe900" stroke="#da291c" strokeWidth="0.6" />
          <rect x="8.2" y="6.6" width="2.8" height="2.8" fill="#ffffff" stroke="#002776" strokeWidth="0.5" />
        </>
      );
    case "crescent-red":
      return (
        <>
          <rect width="24" height="16" fill="#e30a17" />
          <circle cx="9.5" cy="8" r="3.4" fill="#ffffff" />
          <circle cx="10.9" cy="8" r="2.7" fill="#e30a17" />
          <path d="M14.6 8 l1.6-.5 -1 1.35 0-1.7 1 1.35z" fill="#ffffff" />
          <circle cx="15.3" cy="8" r="1.2" fill="#ffffff" />
        </>
      );
    case "usa":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {[0, 2, 4, 6].map((i) => (
            <rect key={i} y={i * 2} width="24" height="2" fill="#b22234" />
          ))}
          <rect y="14" width="24" height="2" fill="#b22234" />
          <rect width="10" height="8" fill="#3c3b6e" />
        </>
      );
    case "sun":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <circle cx="12" cy="8" r="4.2" fill="#bc002d" />
        </>
      );
    case "gre":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {[0, 2, 4, 6, 8].map((i) => (
            <rect key={i} y={i * 1.78} width="24" height="1.78" fill="#0d5eaf" />
          ))}
          <rect width="8.9" height="8.9" fill="#0d5eaf" />
          <rect x="3.6" width="1.8" height="8.9" fill="#ffffff" />
          <rect y="3.6" width="8.9" height="1.8" fill="#ffffff" />
        </>
      );
    case "cross-ch":
      return (
        <>
          <rect width="24" height="16" fill="#d52b1e" />
          <rect x="10.6" y="3.4" width="2.8" height="9.2" fill="#ffffff" />
          <rect x="7.4" y="6.6" width="9.2" height="2.8" fill="#ffffff" />
        </>
      );
    case "chi":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect y="8" width="24" height="8" fill="#d52b1e" />
          <rect width="8" height="8" fill="#0039a6" />
          <path d="M4 2.2 l0.7 2.1 2.2 0 -1.8 1.3 0.7 2.1 -1.8 -1.3 -1.8 1.3 0.7 -2.1 -1.8 -1.3 2.2 0z" fill="#ffffff" />
        </>
      );
    case "col":
      return (
        <>
          <rect width="24" height="16" fill="#fcd116" />
          <rect y="8" width="24" height="4" fill="#003893" />
          <rect y="12" width="24" height="4" fill="#ce1126" />
        </>
      );
    case "uru":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          {[1, 3, 5, 7].map((i) => (
            <rect key={i} y={i * 1.78} width="24" height="1.78" fill="#0038a8" />
          ))}
          <rect width="10" height="8.9" fill="#ffffff" />
          <circle cx="5" cy="4.4" r="2.4" fill="#fcd116" />
        </>
      );
    case "aus":
      return (
        <>
          <rect width="24" height="16" fill="#00247d" />
          <rect width="11" height="8" fill="#00247d" />
          <path d="M0 0 L11 8 M11 0 L0 8" stroke="#ffffff" strokeWidth="1.6" />
          <path d="M5.5 0 V8 M0 4 H11" stroke="#ffffff" strokeWidth="2.4" />
          <path d="M5.5 0 V8 M0 4 H11" stroke="#cf142b" strokeWidth="1.2" />
          <circle cx="17" cy="11" r="1" fill="#ffffff" />
          <circle cx="20" cy="5" r="0.8" fill="#ffffff" />
          <circle cx="15" cy="5.5" r="0.7" fill="#ffffff" />
        </>
      );
    case "kor":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <path d="M12 4.4 a3.6 3.6 0 0 1 0 7.2 a1.8 1.8 0 0 1 0 -3.6 a1.8 1.8 0 0 0 0 -3.6z" fill="#cd2e3a" />
          <path d="M12 4.4 a3.6 3.6 0 0 0 0 7.2 a1.8 1.8 0 0 0 0 -3.6 a1.8 1.8 0 0 1 0 -3.6z" fill="#0047a0" />
        </>
      );
    case "cze":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect y="8" width="24" height="8" fill="#d7141a" />
          <path d="M0 0 L11 8 L0 16 Z" fill="#11457e" />
        </>
      );
    case "rsa":
      return (
        <>
          <rect width="24" height="16" fill="#002395" />
          <rect width="24" height="8" fill="#de3831" />
          <path d="M0 0 L9 8 L0 16 Z" fill="#000000" />
          <path d="M0 2 L7.4 8 L0 14 Z" fill="#ffb612" />
          <path d="M-1 6.2 L6 6.2 L12 1.2 L24 1.2 L24 5.2 L13.5 5.2 L7.6 8 L13.5 10.8 L24 10.8 L24 14.8 L12 14.8 L6 9.8 L-1 9.8 Z" fill="#007a4d" />
        </>
      );
    case "mar":
      return (
        <>
          <rect width="24" height="16" fill="#c1272d" />
          <path d="M12 4.6 l1.5 4.5 -3.8-2.8 h4.6 l-3.8 2.8z" fill="none" stroke="#006233" strokeWidth="0.9" />
        </>
      );
    case "qat":
      return (
        <>
          <rect width="24" height="16" fill="#8d1b3d" />
          <path d="M0 0 H7 L9.6 1.8 L7 3.6 L9.6 5.4 L7 7.2 L9.6 9 L7 10.8 L9.6 12.6 L7 14.4 L9.6 16 H0 Z" fill="#ffffff" />
        </>
      );
    case "uae":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect width="24" height="5.34" fill="#00732f" />
          <rect y="10.66" width="24" height="5.34" fill="#000000" />
          <rect width="7" height="16" fill="#ff0000" />
        </>
      );
    case "tha":
      return (
        <>
          <rect width="24" height="16" fill="#a51931" />
          <rect y="2.7" width="24" height="10.6" fill="#f4f5f8" />
          <rect y="5.4" width="24" height="5.2" fill="#2d2a4a" />
        </>
      );
    case "can":
      return (
        <>
          <rect width="24" height="16" fill="#ffffff" />
          <rect width="6" height="16" fill="#d80621" />
          <rect x="18" width="6" height="16" fill="#d80621" />
          <path d="M12 3.4 l1 2.6 2.2-1 -1 2.6 2.3 .5 -2.6 1.6 .6 2.1 -2.5-.8 -.6 2.4 -.6-2.4 -2.5 .8 .6-2.1 -2.6-1.6 2.3-.5 -1-2.6 2.2 1z" fill="#d80621" />
        </>
      );
    default:
      return <rect width="24" height="16" fill="#334" />;
  }
}

export function Flag({ league, size = 22 }: { league: string; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const key = LEAGUE_COUNTRY[league] ?? league;
  const spec = FLAGS[key];
  const clip = `f${uid}`;

  return (
    <svg
      width={size}
      height={(size / 3) * 2}
      viewBox="0 0 24 16"
      role="img"
      aria-hidden="true"
      className="inline-block shrink-0 rounded-[2px] ring-1 ring-black/40 align-[-0.15em]"
    >
      <defs>
        <clipPath id={clip}>
          <rect width="24" height="16" rx="2" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {!spec && <rect width="24" height="16" fill="#2b3b34" />}
        {spec?.t === "v" &&
          spec.c.map((c, i) => <rect key={i} x={i * 8} width="8" height="16" fill={c} />)}
        {spec?.t === "h" &&
          spec.c.map((c, i) => <rect key={i} y={i * 5.34} width="24" height="5.34" fill={c} />)}
        {spec?.t === "h2" &&
          spec.c.map((c, i) => <rect key={i} y={i * 8} width="24" height="8" fill={c} />)}
        {spec?.t === "nordic" && (
          <>
            <rect width="24" height="16" fill={spec.bg} />
            <rect x="7" width="3.6" height="16" fill={spec.cross} />
            <rect y="6.2" width="24" height="3.6" fill={spec.cross} />
            {spec.inner && (
              <>
                <rect x="8" width="1.6" height="16" fill={spec.inner} />
                <rect y="7.2" width="24" height="1.6" fill={spec.inner} />
              </>
            )}
          </>
        )}
        {spec?.t === "custom" && <Custom k={spec.key} />}
        <rect width="24" height="16" fill="url(#none)" />
      </g>
    </svg>
  );
}
