import type { Club, League } from "../types";

type Raw = [id: string, name: string, short: string, primary: string, secondary: string, strength: number];

const BRA: Raw[] = [
  ["fla", "Flamengo", "FLA", "#c52613", "#111111", 88],
  ["pal", "Palmeiras", "PAL", "#0a6b3c", "#ffffff", 87],
  ["bot", "Botafogo", "BOT", "#141414", "#ffffff", 84],
  ["cru", "Cruzeiro", "CRU", "#1f3f95", "#ffffff", 83],
  ["mgo", "Atlético Mineiro", "CAM", "#101010", "#ffffff", 82],
  ["sao", "São Paulo", "SAO", "#c1121f", "#ffffff", 81],
  ["flu", "Fluminense", "FLU", "#7a1b30", "#0d5b3c", 80],
  ["int", "Internacional", "INT", "#c8102e", "#ffffff", 79],
  ["gre", "Grêmio", "GRE", "#0d8bd9", "#111111", 79],
  ["cor", "Corinthians", "COR", "#101010", "#ffffff", 79],
  ["bah", "Bahia", "BAH", "#1c5cb8", "#e10600", 78],
  ["vas", "Vasco da Gama", "VAS", "#111111", "#ffffff", 77],
  ["for", "Fortaleza", "FOR", "#1a3fa0", "#e10600", 76],
  ["san", "Santos", "SAN", "#f2f2f2", "#111111", 76],
  ["rbb", "Red Bull Bragantino", "RBB", "#e10600", "#ffffff", 75],
  ["mir", "Mirassol", "MIR", "#f5b400", "#0a6b3c", 73],
  ["cea", "Ceará", "CEA", "#101010", "#ffffff", 72],
  ["spt", "Sport Recife", "SPT", "#c8102e", "#111111", 71],
  ["vit", "Vitória", "VIT", "#c8102e", "#111111", 71],
  ["juv", "Juventude", "JUV", "#0a8f3c", "#ffffff", 69],
];

const ENG: Raw[] = [
  ["liv", "Liverpool", "LIV", "#c8102e", "#ffffff", 91],
  ["ars", "Arsenal", "ARS", "#ef0107", "#ffffff", 90],
  ["mci", "Manchester City", "MCI", "#6cabdd", "#ffffff", 90],
  ["che", "Chelsea", "CHE", "#034694", "#ffffff", 87],
  ["new", "Newcastle United", "NEW", "#111111", "#ffffff", 85],
  ["avl", "Aston Villa", "AVL", "#670e36", "#95bfe5", 84],
  ["tot", "Tottenham Hotspur", "TOT", "#f1f1f1", "#132257", 83],
  ["mun", "Manchester United", "MUN", "#da291c", "#ffffff", 83],
  ["bha", "Brighton", "BHA", "#0057b8", "#ffffff", 81],
  ["cry", "Crystal Palace", "CRY", "#1b458f", "#c4122e", 80],
  ["bou", "Bournemouth", "BOU", "#da291c", "#111111", 79],
  ["ful", "Fulham", "FUL", "#f5f5f5", "#111111", 78],
  ["bre", "Brentford", "BRE", "#e30613", "#ffffff", 77],
  ["nfo", "Nottingham Forest", "NFO", "#dd0000", "#ffffff", 77],
  ["whu", "West Ham United", "WHU", "#7a263a", "#1bb1e7", 76],
  ["eve", "Everton", "EVE", "#003399", "#ffffff", 76],
  ["wol", "Wolverhampton", "WOL", "#fdb913", "#111111", 74],
  ["lee", "Leeds United", "LEE", "#ffffff", "#1d428a", 73],
  ["sun", "Sunderland", "SUN", "#eb172b", "#ffffff", 72],
  ["bur", "Burnley", "BUR", "#6c1d45", "#99d6ea", 70],
];

const ESP: Raw[] = [
  ["rma", "Real Madrid", "RMA", "#f7f7f7", "#febe10", 92],
  ["bar", "Barcelona", "BAR", "#a50044", "#004d98", 91],
  ["atm", "Atlético de Madrid", "ATM", "#cb3524", "#272e61", 87],
  ["ath", "Athletic Club", "ATH", "#ee2523", "#ffffff", 83],
  ["vil", "Villarreal", "VIL", "#ffe667", "#005187", 82],
  ["bet", "Real Betis", "BET", "#0bb363", "#ffffff", 81],
  ["rso", "Real Sociedad", "RSO", "#0067b1", "#ffffff", 80],
  ["sev", "Sevilla", "SEV", "#f4f4f4", "#d81920", 78],
  ["cel", "Celta de Vigo", "CEL", "#8ac3ee", "#ffffff", 77],
  ["ray", "Rayo Vallecano", "RAY", "#f7f7f7", "#e53027", 76],
  ["val", "Valencia", "VAL", "#f7f7f7", "#ee3524", 76],
  ["osa", "Osasuna", "OSA", "#0a346f", "#d81e05", 75],
  ["gir", "Girona", "GIR", "#d6001c", "#ffffff", 75],
  ["mlg", "Mallorca", "MLG", "#e20613", "#111111", 74],
  ["get", "Getafe", "GET", "#005999", "#ffffff", 73],
  ["esp", "Espanyol", "ESP", "#0072ce", "#ffffff", 73],
  ["alv", "Deportivo Alavés", "ALV", "#0761af", "#ffffff", 72],
  ["elc", "Elche", "ELC", "#f7f7f7", "#00a94f", 70],
  ["lev", "Levante", "LEV", "#004b9b", "#c8102e", 69],
  ["ovi", "Real Oviedo", "OVI", "#0055a4", "#ffffff", 68],
];

const ITA: Raw[] = [
  ["int_i", "Inter", "INT", "#0068a8", "#111111", 89],
  ["nap", "Napoli", "NAP", "#12a0d7", "#ffffff", 88],
  ["mil", "Milan", "MIL", "#fb090b", "#111111", 86],
  ["juv_i", "Juventus", "JUV", "#f7f7f7", "#111111", 85],
  ["ata", "Atalanta", "ATA", "#1d5aa8", "#111111", 84],
  ["rom", "Roma", "ROM", "#8e1f2f", "#f0bc42", 83],
  ["laz", "Lazio", "LAZ", "#87d8f7", "#ffffff", 81],
  ["fio", "Fiorentina", "FIO", "#7b2c8f", "#ffffff", 80],
  ["bol", "Bologna", "BOL", "#1a2f57", "#a21c26", 79],
  ["com", "Como", "COM", "#0a3d91", "#ffffff", 77],
  ["tor", "Torino", "TOR", "#7a1c22", "#ffffff", 76],
  ["udi", "Udinese", "UDI", "#111111", "#ffffff", 75],
  ["gen", "Genoa", "GEN", "#a21c26", "#0a3d91", 74],
  ["cag", "Cagliari", "CAG", "#a4133c", "#0a3d91", 73],
  ["ver", "Hellas Verona", "VER", "#f7d417", "#0a3d91", 72],
  ["lec", "Lecce", "LEC", "#f7d417", "#a4133c", 71],
  ["par", "Parma", "PAR", "#f7e04a", "#0a72bb", 71],
  ["sas", "Sassuolo", "SAS", "#00a752", "#111111", 70],
  ["pis", "Pisa", "PIS", "#0a3d91", "#ffffff", 69],
  ["cre", "Cremonese", "CRE", "#a4133c", "#7a7a7a", 68],
];

function build(id: string, name: string, country: string, flag: string, raw: Raw[]): League {
  const clubs: Club[] = raw.map(([cid, cname, short, primary, secondary, strength]) => ({
    id: cid,
    name: cname,
    short,
    league: id,
    primary,
    secondary,
    strength,
  }));
  return { id, name, country, flag, clubs };
}

export const LEAGUES: League[] = [
  build("bra", "Brasileirão Série A", "Brasil", "🇧🇷", BRA),
  build("eng", "Premier League", "Inglaterra", "🏴", ENG),
  build("esp", "LaLiga", "Espanha", "🇪🇸", ESP),
  build("ita", "Serie A", "Itália", "🇮🇹", ITA),
];

export const CLUBS: Record<string, Club> = Object.fromEntries(
  LEAGUES.flatMap((l) => l.clubs).map((c) => [c.id, c]),
);

export function getLeague(id: string): League {
  return LEAGUES.find((l) => l.id === id) ?? LEAGUES[0]!;
}
