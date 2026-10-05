import type { KitStyle } from "./customStyle";

/**
 * Uniformes reais (cores e desenho aproximados da camisa titular/reserva)
 * dos clubes mais conhecidos. Personalização do jogador sempre vence.
 */
const k = (
  pattern: KitStyle["pattern"],
  base: string,
  detail: string,
  shorts: string,
  socks: string,
  awayBase: string,
  awayDetail: string,
): KitStyle => ({ pattern, base, detail, shorts, socks, awayBase, awayDetail });

export const REAL_KITS: Record<string, KitStyle> = {
  fla: k("hoops", "#c52613", "#111111", "#ffffff", "#c52613", "#ffffff", "#c52613"),
  pal: k("solid", "#0a6b3c", "#ffffff", "#ffffff", "#0a6b3c", "#ffffff", "#0a6b3c"),
  bot: k("stripes", "#141414", "#ffffff", "#141414", "#9a9a9a", "#ffffff", "#141414"),
  cru: k("solid", "#1f3f95", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#1f3f95"),
  mgo: k("stripes", "#101010", "#ffffff", "#101010", "#ffffff", "#ffffff", "#101010"),
  sao: k("band", "#ffffff", "#c1121f", "#ffffff", "#ffffff", "#c1121f", "#111111"),
  flu: k("stripes", "#7a1b30", "#0d5b3c", "#ffffff", "#ffffff", "#ffffff", "#7a1b30"),
  int: k("solid", "#c8102e", "#ffffff", "#ffffff", "#c8102e", "#ffffff", "#c8102e"),
  gre: k("stripes", "#0d8bd9", "#111111", "#111111", "#ffffff", "#ffffff", "#0d8bd9"),
  cor: k("solid", "#ffffff", "#101010", "#101010", "#101010", "#101010", "#ffffff"),
  bah: k("solid", "#ffffff", "#1c5cb8", "#1c5cb8", "#ffffff", "#e10600", "#1c5cb8"),
  vas: k("sash", "#ffffff", "#111111", "#111111", "#111111", "#111111", "#ffffff"),
  for: k("stripes", "#1a3fa0", "#e10600", "#ffffff", "#1a3fa0", "#ffffff", "#e10600"),
  san: k("solid", "#f2f2f2", "#111111", "#f2f2f2", "#f2f2f2", "#111111", "#f2f2f2"),
  cha: k("solid", "#0a8f3c", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#0a8f3c"),
  ath: k("stripes", "#c8102e", "#111111", "#111111", "#c8102e", "#111111", "#c8102e"),
  liv: k("solid", "#c8102e", "#ffffff", "#c8102e", "#c8102e", "#f2efe6", "#111111"),
  ars: k("sleeves", "#ef0107", "#ffffff", "#ffffff", "#ffffff", "#f2d24b", "#132257"),
  mci: k("solid", "#6cabdd", "#ffffff", "#ffffff", "#6cabdd", "#1c2c5b", "#6cabdd"),
  che: k("solid", "#034694", "#ffffff", "#034694", "#ffffff", "#ffffff", "#034694"),
  mun: k("solid", "#da291c", "#111111", "#ffffff", "#111111", "#ffffff", "#da291c"),
  tot: k("solid", "#f1f1f1", "#132257", "#132257", "#f1f1f1", "#132257", "#f1f1f1"),
  new: k("stripes", "#111111", "#ffffff", "#111111", "#111111", "#ffffff", "#111111"),
};
