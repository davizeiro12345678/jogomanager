/** Authored event-specific alternatives. No invented scorer, assist or shot geometry. */
export const EDITORIAL_NARRATION = {
  pt: {
    goal: [
      "GOOOOL DO {team}! A bola entrou e a torcida responde!",
      "Tá lá dentro! O {team} transforma a chance em gol!",
      "É rede balançando para o {team}! Que momento da partida!",
      "Gol confirmado no placar! Festa para o {team}!",
      "O {team} marca! Um grito que toma conta da arquibancada!",
      "Entrou! O {team} encontra o gol e muda o placar!",
    ],
    save: [
      "O goleiro do {team} aparece na hora certa!",
      "Não passou! Grande defesa do goleiro do {team}!",
      "O {team} respira depois da intervenção do goleiro.",
      "O goleiro do {team} impede mais um gol!",
    ],
    shot: [
      "Vem finalização do {team}! Atenção ao lance!",
      "O {team} tenta o gol! Acompanhe a bola!",
      "Tentativa do {team} na direção do gol!",
      "O {team} conclui o ataque com uma finalização!",
    ],
    post: [
      "A bola encontra a trave! Quase para o {team}!",
      "O {team} fica no quase! A trave impediu o gol!",
      "Bola na madeira! O {team} levou perigo de verdade!",
      "A torcida do {team} já preparava o grito, mas deu trave!",
    ],
    chance: [
      "O {team} se aproxima! A defesa precisa reagir!",
      "Tem espaço para o {team}! Olho nessa chegada!",
      "A torcida acompanha de pé essa chance do {team}!",
      "O {team} encontra uma oportunidade! Vamos ao lance!",
    ],
    corner: [
      "Escanteio do {team}. Agora vale a organização na área.",
      "O {team} prepara a cobrança. A defesa ajusta a marcação.",
      "A bola volta para o {team} no escanteio.",
      "Mais uma oportunidade de bola parada para o {team}.",
    ],
    sub: [
      "O {team} renova as opções em campo.",
      "A comissão técnica do {team} confirma a troca.",
      "Mudança no {team}. É hora de ajustar o plano de jogo.",
      "O {team} recorre ao banco para a sequência da partida.",
    ],
    foul: [
      "Apito no lance do {team}. A jogada foi interrompida.",
      "Falta assinalada contra o {team}. O jogo para.",
      "O árbitro marca a infração do {team}.",
      "O {team} comete a falta. A cobrança será do adversário.",
    ],
    card: [
      "O árbitro apresenta o cartão ao {team}.",
      "Advertência para o {team}. É preciso cuidado nos próximos lances.",
      "O jogador do {team} entra na lista de advertidos.",
      "Cartão mostrado. O {team} precisa administrar essa situação.",
    ],
    redCard: [
      "Vermelho para o {team}! A expulsão muda os planos!",
      "O {team} fica com um jogador a menos após o cartão vermelho!",
      "Expulsão no {team}! O técnico vai precisar reorganizar a equipe!",
      "O árbitro confirma o vermelho para o {team}!",
    ],
    kickoff: [
      "Começa a partida. Acompanhe cada decisão dentro de campo!",
      "Bola em jogo! Está aberto mais um capítulo dessa disputa!",
      "O árbitro autoriza. Vamos acompanhar o encontro!",
      "Tudo pronto em campo. A partida começa agora!",
    ],
    halftime: [
      "O árbitro encerra a primeira etapa. Intervalo para as equipes.",
      "Pausa no jogo. Os técnicos têm tempo para ajustar o posicionamento.",
      "Termina a primeira metade da partida. Ainda há muito em disputa.",
      "Intervalo. Hora de recuperar o fôlego e rever a estratégia.",
    ],
    fulltime: [
      "Partida encerrada. O resultado está confirmado.",
      "Soa o apito final. As equipes encerram o confronto.",
      "Fim de jogo. Agora é avaliar o que aconteceu em campo.",
      "O árbitro encerra o encontro. Está definido o resultado.",
    ],
  },
  en: {
    goal: ["GOAL FOR {team}! The scoreboard changes!", "{team} score! Listen to that crowd!"],
    save: [
      "The {team} goalkeeper keeps it out!",
      "A vital intervention from the {team} goalkeeper!",
    ],
    shot: ["{team} take the shot! Watch the ball!", "An effort at goal from {team}!"],
    post: ["The woodwork denies {team}!", "So close for {team}! It hits the frame of the goal!"],
    chance: ["An opening for {team}! The defence must react!", "{team} have an opportunity here!"],
    corner: [
      "{team} prepare the corner. The defence reorganises.",
      "A set-piece opportunity for {team}.",
    ],
    sub: ["{team} turn to the bench for a change.", "A substitution is confirmed for {team}."],
    foul: [
      "The referee stops play for a foul by {team}.",
      "An infringement by {team}. Play is interrupted.",
    ],
    card: [
      "A booking for {team}. More care needed now.",
      "The referee shows a card to the {team} player.",
    ],
    redCard: ["A red card for {team}! They must reorganise!", "{team} are reduced to ten players!"],
    kickoff: [
      "The referee gets the match under way!",
      "The ball is in play. Let's follow the action!",
    ],
    halftime: [
      "The first half is over. Time for the teams to regroup.",
      "Half-time. Both coaches can now adjust their plans.",
    ],
    fulltime: [
      "The final whistle confirms the result.",
      "The referee ends the match. The contest is over.",
    ],
  },
  es: {
    goal: [
      "¡GOOOL DEL {team}! ¡Cambia el marcador!",
      "¡Marca el {team}! ¡Así responde la afición!",
    ],
    save: [
      "¡El portero del {team} evita el gol!",
      "¡Una intervención importante del portero del {team}!",
    ],
    shot: ["¡Remata el {team}! ¡Atención al balón!", "¡Un intento de gol del {team}!"],
    post: [
      "¡La madera impide el gol del {team}!",
      "¡Casi marca el {team}! ¡El balón golpea el poste!",
    ],
    chance: [
      "¡Una oportunidad para el {team}! ¡La defensa debe reaccionar!",
      "¡El {team} encuentra una opción de ataque!",
    ],
    corner: [
      "El {team} prepara el córner. La defensa se reorganiza.",
      "Una oportunidad a balón parado para el {team}.",
    ],
    sub: [
      "El {team} recurre al banquillo para hacer un cambio.",
      "Se confirma la sustitución en el {team}.",
    ],
    foul: [
      "El árbitro detiene el juego por una falta del {team}.",
      "Infracción del {team}. Se interrumpe la jugada.",
    ],
    card: [
      "Amonestación para el {team}. Hay que tener más cuidado.",
      "El árbitro muestra la tarjeta al jugador del {team}.",
    ],
    redCard: [
      "¡Roja para el {team}! ¡Toca reorganizarse!",
      "¡El {team} se queda con un jugador menos!",
    ],
    kickoff: ["¡El árbitro da comienzo al encuentro!", "¡Balón en juego! ¡Vamos con el partido!"],
    halftime: [
      "Termina la primera parte. Tiempo para recuperar fuerzas.",
      "Descanso. Los entrenadores pueden ajustar sus planes.",
    ],
    fulltime: [
      "El pitido final confirma el resultado.",
      "El árbitro termina el encuentro. El partido ha concluido.",
    ],
  },
} as const;
