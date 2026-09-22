/**
 * Catálogo único das câmeras de partida.
 *
 * As rotas de carreira, partida rápida, multiplayer e replays usam esta fonte
 * para não deixarem câmeras novas invisíveis em uma parte do jogo. O `id` é
 * estável porque também é salvo em replays/URLs no futuro; os textos podem ser
 * refinados sem mudar o contrato de renderização.
 */
export const CAMERA_OPTIONS = [
  {
    id: "broadcast",
    label: "TV",
    shortLabel: "TV",
    description: "Transmissão automática, aberta e orientada pelo lance.",
  },
  {
    id: "director",
    label: "Diretor",
    shortLabel: "Dir.",
    description: "Cortes cinematográficos com retenção segura entre planos.",
  },
  {
    id: "cinematic",
    label: "Cinema",
    shortLabel: "Cinema",
    description: "Plano de grua artístico com pós-processamento cinematográfico.",
  },
  {
    id: "skycam",
    label: "Skycam",
    shortLabel: "Sky",
    description: "Vista aérea móvel que antecipa a trajetória da bola.",
  },
  {
    id: "tactical",
    label: "Tática",
    shortLabel: "Tática",
    description: "Leitura ampla das linhas, espaços e formações.",
  },
  {
    id: "sideline",
    label: "Lateral",
    shortLabel: "Lateral",
    description: "Câmera baixa da área técnica, junto ao campo.",
  },
  {
    id: "rail",
    label: "Trilho",
    shortLabel: "Trilho",
    description: "Travelling rente à lateral para acompanhar a jogada.",
  },
  {
    id: "player",
    label: "Jogador",
    shortLabel: "Jogador",
    description: "Enquadramento fechado dos duelos e do portador da bola.",
  },
  {
    id: "behind",
    label: "Atrás",
    shortLabel: "Atrás",
    description: "Segue por trás o jogador que conduz a posse.",
  },
  {
    id: "goal",
    label: "Gol",
    shortLabel: "Gol",
    description: "Câmera atrás da rede para finalizações e defesas.",
  },
  {
    id: "fan",
    label: "Torcida",
    shortLabel: "Torcida",
    description: "Arquibancada viva, com visão de torcedor.",
  },
] as const;

export type CameraMode = (typeof CAMERA_OPTIONS)[number]["id"];
export type CameraOption = (typeof CAMERA_OPTIONS)[number];

/** Devolve a opção visível para o modo atual, sem duplicar rótulos nos HUDs. */
export function cameraOption(mode: CameraMode): CameraOption {
  return CAMERA_OPTIONS.find((option) => option.id === mode) ?? CAMERA_OPTIONS[0]!;
}

/** Próxima câmera na ordem de uso mais natural para botões compactos e tecla C. */
export function nextCameraMode(mode: CameraMode): CameraMode {
  const index = CAMERA_OPTIONS.findIndex((option) => option.id === mode);
  return CAMERA_OPTIONS[(index + 1 + CAMERA_OPTIONS.length) % CAMERA_OPTIONS.length]!.id;
}
