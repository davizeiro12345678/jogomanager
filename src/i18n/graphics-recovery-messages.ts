const copy = {
  "pt-BR": {
    unavailable: "A visualização 3D não carregou.",
    followIn2D: "Estádio 3D indisponível. Acompanhe a partida em 2D.",
    pitch: "Campo da partida em 2D",
    retry3D: "Tentar novamente em 3D",
  },
  en: {
    unavailable: "The 3D preview did not load.",
    followIn2D: "The 3D stadium is unavailable. Follow the match in 2D.",
    pitch: "2D match pitch",
    retry3D: "Retry 3D",
  },
} as const;

export function graphicsRecoveryMessages(lang: string) {
  return lang.startsWith("pt") ? copy["pt-BR"] : copy.en;
}
