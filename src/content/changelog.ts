/** Novidades do jogo, mostradas na página pública "Criador". */
export interface ChangelogEntry {
  date: string;
  title: string;
  items: string[];
}

export const CREATOR = {
  name: "Davi Andrian Thomazini",
  role: "Criador e desenvolvedor",
  bio: "Fã de futebol e de jogos de gestão, construindo um manager 3D gratuito que roda direto no navegador, em qualquer celular ou computador.",
  youtube: "https://www.youtube.com/@Davizeirogames",
  youtubeLabel: "@Davizeirogames",
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-09",
    title: "Modo automático e histórico por partida",
    items: [
      "Nova tela de temporada automática: o computador joga por você, semana a semana ou até o fim.",
      "Estatísticas agora guardam o histórico de cada partida, com gols, assistências e notas.",
      "Resumos de rodada animados, respeitando a opção de reduzir movimento.",
    ],
  },
  {
    date: "2026-09",
    title: "Partida rápida e desempenho no celular",
    items: [
      "Tela de partida rápida: escolha seu time e enfrente o computador com narração e placar ao vivo.",
      "Qualidade gráfica automática conforme o aparelho e pausa do desenho quando a aba fica em segundo plano.",
      "Simulação pesada movida para segundo plano, sem travar partidas longas.",
    ],
  },
  {
    date: "2026-09",
    title: "Mundo do jogo maior",
    items: [
      "Mais de 100 ligas e mais de 1.300 clubes com escudos, uniformes e cores próprias.",
      "39 idiomas com detecção automática pelo navegador.",
      "Narração ao vivo em português, inglês e espanhol.",
    ],
  },
];
