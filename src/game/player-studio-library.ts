export const MOVEMENT_GROUPS = [
  "all",
  "locomotion",
  "ball",
  "defense",
  "keeper",
  "recovery",
] as const;
export type MovementGroup = (typeof MOVEMENT_GROUPS)[number];

export function movementGroup(id: string): Exclude<MovementGroup, "all"> {
  if (
    /^(receiveOriented|chestControlExit|thighCushion|shieldPivot|runningPassRecover|offBalanceFinish)/.test(
      id,
    )
  )
    return "ball";
  if (/^(brakeCut90|backpedalBurst)/.test(id)) return "locomotion";
  if (id === "tackleRecover") return "defense";
  if (/^(keeper|dive|save|catch)/.test(id)) return "keeper";
  if (
    /^(pass|cross|shot|chip|volley|firstTime|trap|dribble|feint|stepover|cut|elastico|throwIn|header)/.test(
      id,
    )
  )
    return "ball";
  if (/^(readyPress|tackle|slide|block|duel|lateralReach|splitStep)/.test(id)) return "defense";
  if (
    /^(walk|run|sprint|accelerate|decelerate|curveRun|sideStep|backpedal|kneeDrive|heelRecovery)/.test(
      id,
    )
  )
    return "locomotion";
  return "recovery";
}

export function movementSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}

export function studioLibraryCopy(lang: string) {
  return lang.startsWith("pt")
    ? {
        search: "Buscar movimento",
        placeholder: "Ex.: passe, defesa, tornozelo…",
        clear: "Limpar busca",
        group: "Tipo de movimento",
        current: "Em exibição",
        results: "movimentos disponíveis",
        all: "Todos",
        locomotion: "Deslocamento",
        ball: "Com bola",
        defense: "Defesa",
        keeper: "Goleiro",
        recovery: "Postura e recuperação",
        quick: "Acesso rápido aos movimentos",
      }
    : {
        search: "Find a movement",
        placeholder: "Pass, save, ankle…",
        clear: "Clear search",
        group: "Movement type",
        current: "Now showing",
        results: "available movements",
        all: "All",
        locomotion: "Locomotion",
        ball: "On the ball",
        defense: "Defense",
        keeper: "Goalkeeper",
        recovery: "Posture and recovery",
        quick: "Quick movement selection",
      };
}
