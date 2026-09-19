/**
 * Falas do narrador — compartilhadas entre cliente e servidor.
 *
 * O servidor gera o áudio a partir DESTAS frases (nunca de texto livre vindo do
 * navegador), então o endpoint de voz não pode ser usado como TTS genérico.
 */

export type NarrationEvent =
  | "goal"
  | "save"
  | "shot"
  | "post"
  | "foul"
  | "card"
  | "redCard"
  | "chance"
  | "corner"
  | "sub"
  | "kickoff"
  | "halftime"
  | "fulltime";

export type NarrationLang = "pt" | "en" | "es";

/** Idiomas suportados pela narração; qualquer outro cai para inglês. */
export function narrationLang(tag: string | undefined): NarrationLang {
  const base = (tag ?? "en").toLowerCase().split("-")[0];
  if (base === "pt") return "pt";
  if (base === "es") return "es";
  return "en";
}

/** Tag BCP-47 usada pela voz do navegador quando o áudio realista falha. */
export const SPEECH_TAG: Record<NarrationLang, string> = {
  pt: "pt-BR",
  en: "en-GB",
  es: "es-ES",
};

/** Vozes ElevenLabs por idioma — narração empolgada, estilo transmissão. */
export const VOICE_BY_LANG: Record<NarrationLang, string> = {
  pt: "TX3LPaxmHKxFdv7VOQHJ", // Liam — jovem, energético (estilo Cazé TV)
  en: "JBFqnCBsd6RMkjVDRZzb", // George — locutor clássico
  es: "iP95p4xoKVk53GoZ742B", // Chris — animado
};

type Pack = Record<NarrationEvent, string[]>;

const PT: Pack = {
  goal: [
    "AÊÊÊ! É GOL DO {team}! Que coisa linda!",
    "BALANÇOU A REDE! GOL DO {team}!",
    "É GOL! É GOL! É GOL DO {team}, meu amigo!",
    "OLHA O GOLAÇO DO {team}! Explode o estádio!",
    "NÃO ACREDITO NISSO! GOL DO {team}!",
    "GOOOOL! O {team} abre o coração da torcida!",
    "PRA DENTRO! Que finalização do {team}!",
    "ESTUFOU! O goleiro só olhou a bola entrar. Gol do {team}!",
    "QUE PINTURA! O {team} marca um gol de placa!",
    "NO ÂNGULO! Impossível defender. Gol do {team}!",
    "A TORCIDA DO {team} VAI À LOUCURA! É GOL!",
    "DE PRIMEIRA, SEM DÓ! Gol do {team}!",
    "O {team} encontrou o caminho do gol. Que jogada ensaiada!",
    "ACABOU O SUSPENSE: GOL DO {team}!",
  ],
  save: [
    "PEGOOOU! Que defesaça do goleiro do {team}!",
    "Espalmou! O goleiro do {team} salvou o time!",
    "MILAGRE! Defesa absurda do {team}!",
    "QUE REFLEXO! O arqueiro do {team} apareceu bem.",
    "Defendeu com o pé! Inacreditável o goleiro do {team}!",
    "Segurou firme. Noite inspirada do goleiro do {team}.",
    "MANDOU PRA ESCANTEIO! Grande intervenção do {team}.",
  ],
  shot: [
    "Chutou o {team}! Passou perto!",
    "Arriscou de fora da área o {team}!",
    "Finaliza o {team}, e o goleiro leva perigo!",
    "Bateu colocado o {team}! Raspou a rede pelo lado de fora.",
    "Tentou encobrir o goleiro, o {team}! Foi por cima.",
    "Pegou mal na bola o {team}. A torcida lamenta.",
    "Chute forte do {team}! Desviou e saiu.",
  ],
  post: [
    "NA TRAVE! O {team} quase marcou!",
    "Explodiu no poste! Que azar do {team}!",
    "NO TRAVESSÃO! A bola ainda voltou pro campo. Que sufoco!",
    "A trave é amiga do goleiro — e inimiga do {team} hoje!",
  ],
  chance: [
    "Perigo! O {team} chega com tudo!",
    "Que jogada do {team}! O ataque desceu bonito!",
    "O {team} ganhou as costas da zaga! Vem aí!",
    "Toque de primeira, tabelinha: o {team} está por cima.",
    "Contra-ataque puxado pelo {team}! Espaço livre pela frente.",
    "A pressão do {team} não para. A defesa está pedindo água.",
  ],
  corner: [
    "Escanteio para o {team}. Todo mundo na área!",
    "Vai a bola na área: córner do {team}.",
    "Mais um escanteio do {team}. A zaga se organiza.",
    "Bola parada perigosa para o {team}.",
  ],
  sub: [
    "Mexe o técnico do {team}: mudança no time.",
    "Substituição no {team}. Sangue novo em campo.",
    "Entra jogador descansado pelo {team}.",
    "O banco do {team} entra em ação.",
  ],
  foul: [
    "Faltou o {team}. O árbitro marca.",
    "Parou o lance: falta do {team}.",
    "Chegou atrasado o jogador do {team}. Falta.",
    "O juiz apita: infração do {team} no meio-campo.",
  ],
  card: [
    "Cartão para o {team}! O árbitro não perdoou.",
    "Vai anotar! Cartão para o jogador do {team}.",
    "Amarelo merecido para o {team}. Tem que segurar a bronca.",
    "O árbitro leva a mão ao bolso: cartão no {team}.",
  ],
  redCard: [
    "EXPULSO! Cartão vermelho para o {team}! O jogo muda agora!",
    "VERMELHO DIRETO! O {team} vai terminar com um a menos!",
    "O árbitro não hesitou: rua para o jogador do {team}!",
    "Que prejuízo para o {team}! Expulsão em um momento decisivo.",
    "O {team} perde um jogador. Agora é reorganizar tudo em campo!",
  ],
  kickoff: [
    "A BOLA VAI ROLAR! Começa o jogo!",
    "Apitou o árbitro: começa a partida!",
    "Estádio cheio, bandeiras no ar: rola a bola!",
    "Tudo pronto. Começa mais um clássico de emoções!",
  ],
  halftime: [
    "Fim do primeiro tempo. Que jogo!",
    "Vamos para o intervalo.",
    "Primeira etapa encerrada. Hora dos ajustes no vestiário.",
  ],
  fulltime: [
    "ACABOU! Fim de jogo!",
    "Apita o árbitro: está encerrada a partida!",
    "Fim de papo! O placar está definido.",
    "Terminou! Que espetáculo o futebol nos deu hoje.",
  ],
};

const EN: Pack = {
  goal: [
    "GOAL! What a strike from {team}!",
    "IT'S IN! {team} find the net!",
    "OH, THAT IS BRILLIANT! Goal for {team}!",
    "The stadium erupts — {team} score!",
    "TOP CORNER! No chance for the keeper. {team}!",
    "First time, no hesitation — {team} score!",
    "What a finish! {team} make it count.",
    "The net bulges and {team} are celebrating!",
    "Clinical from {team}. A goal out of nothing!",
  ],
  save: [
    "WHAT A SAVE! The {team} keeper is on fire!",
    "Superb stop! {team} survive that one!",
    "Fingertips! The {team} goalkeeper says no.",
    "Brave hands from the {team} keeper.",
    "Pushed round the post — brilliant from {team}.",
  ],
  shot: [
    "{team} let fly — just wide!",
    "A crack at goal from {team}!",
    "{team} try their luck from distance. Over the bar.",
    "Deflected behind! {team} keep asking questions.",
  ],
  post: [
    "OFF THE WOODWORK! So close for {team}!",
    "The post denies {team}!",
    "Off the crossbar and away — agony for {team}!",
  ],
  chance: [
    "Danger here! {team} pour forward!",
    "Lovely move from {team}!",
    "{team} in behind — this is a big moment.",
    "The pressure from {team} is relentless.",
  ],
  corner: [
    "Corner to {team}. Everyone up for this one.",
    "Set piece for {team} — it's whipped in.",
    "Another corner for {team}. The defence braces.",
  ],
  sub: [
    "A change for {team}. Fresh legs coming on.",
    "{team} go to the bench.",
    "Tactical switch from the {team} manager.",
  ],
  foul: [
    "Foul given against {team}.",
    "The whistle goes — {team} give one away.",
    "Late challenge from {team}. Free kick.",
  ],
  card: [
    "A card for {team}!",
    "The referee reaches for his pocket — {team}.",
    "Booked. {team} will have to be careful now.",
  ],
  redCard: [
    "HE IS OFF! A straight red card for {team}!",
    "RED CARD! {team} must finish with ten players!",
    "The referee has no doubt — dismissal for {team}!",
    "A huge turning point. {team} are a player down.",
  ],
  kickoff: ["We are underway!", "Kick-off! Here we go!", "The referee blows and we're off."],
  halftime: ["That's half-time.", "The whistle goes for the break.", "Forty-five gone."],
  fulltime: [
    "FULL TIME! It's all over!",
    "The referee ends it here!",
    "That's the final whistle. What a match.",
  ],
};

const ES: Pack = {
  goal: [
    "¡GOOOOL DEL {team}! ¡Qué golazo!",
    "¡LA CLAVÓ! ¡Gol del {team}!",
    "¡NO LO PUEDO CREER! ¡Marca el {team}!",
    "¡AL ÁNGULO! ¡Imposible para el portero! ¡Gol del {team}!",
    "¡ESTALLA EL ESTADIO! ¡Gol del {team}!",
    "¡Definición perfecta del {team}!",
    "¡De primera y adentro! ¡Gol del {team}!",
  ],
  save: [
    "¡QUÉ PARADÓN del portero del {team}!",
    "¡Enorme atajada del {team}!",
    "¡Manos firmes! El arquero del {team} responde.",
    "¡La mandó al córner! Gran intervención del {team}.",
  ],
  shot: [
    "¡Remata el {team}! ¡Se fue cerca!",
    "¡Prueba desde lejos el {team}!",
    "¡Disparo desviado del {team}!",
    "¡Buscó la escuadra el {team}! Rozó el palo.",
  ],
  post: [
    "¡AL PALO! ¡Casi el {team}!",
    "¡El travesaño le dice que no al {team}!",
    "¡En el poste y afuera! ¡Qué mala suerte del {team}!",
  ],
  chance: [
    "¡Peligro! ¡Ataca el {team}!",
    "¡Qué jugada del {team}!",
    "¡El {team} se metió por detrás de la defensa!",
    "¡El {team} no da respiro!",
  ],
  corner: [
    "Córner para el {team}. Todos al área.",
    "Balón parado peligroso del {team}.",
    "Otro tiro de esquina del {team}.",
  ],
  sub: [
    "Cambio en el {team}. Piernas frescas.",
    "Mueve el banquillo el {team}.",
    "Ajuste táctico del entrenador del {team}.",
  ],
  foul: [
    "Falta del {team}.",
    "El árbitro pita falta del {team}.",
    "Llegó tarde el jugador del {team}. Falta.",
  ],
  card: [
    "¡Tarjeta para el {team}!",
    "El árbitro amonesta al {team}.",
    "Amarilla para el {team}. Ojo con eso.",
  ],
  redCard: [
    "¡EXPULSADO! ¡Tarjeta roja para el {team}!",
    "¡ROJA DIRECTA! El {team} se queda con diez.",
    "El árbitro no duda: expulsión para el {team}.",
    "Momento decisivo. El {team} pierde a un jugador.",
  ],
  kickoff: ["¡Rueda el balón! ¡Comienza el partido!", "¡Arrancó el juego!", "¡Se pone en marcha!"],
  halftime: ["Final del primer tiempo.", "Nos vamos al descanso.", "Cuarenta y cinco cumplidos."],
  fulltime: [
    "¡SE ACABÓ! ¡Final del partido!",
    "¡El árbitro decreta el final!",
    "¡Final! Qué partido nos regaló el fútbol.",
  ],
};

/**
 * Segunda leva de falas — amplia o repertório sem tocar nas frases originais.
 * Aqui entram variações de emoção: rotina, tensão, euforia, decepção e ironia.
 */
const EXTRA: Record<NarrationLang, Partial<Pack>> = {
  pt: {
    goal: [
      "É DELE! É DO {team}! O estádio treme!",
      "Que sofrimento valeu a pena: GOL DO {team}!",
      "Bateu rasteiro, no cantinho. Gol do {team}!",
      "O goleiro voou, mas não alcançou. Gol do {team}!",
      "De cabeça, com categoria! Gol do {team}!",
      "Contra-ataque mortal e o {team} não perdoa!",
      "Mudou o jogo! O {team} vira a chave no placar.",
      "Gol de artilheiro: o {team} estava só esperando a chance.",
      "Sem chance de defesa. Gol do {team} e olha o abraço!",
    ],
    save: [
      "Que colocação! O goleiro do {team} tinha lido o lance.",
      "Fechou o ângulo e defendeu. Aula do goleiro do {team}.",
      "No susto, mas segurou! O {team} agradece.",
      "Saiu bem do gol o arqueiro do {team}.",
      "Rebateu e ninguém pegou a sobra. Uff, {team}!",
    ],
    shot: [
      "Mandou por cima o {team}. A torcida leva a mão à cabeça.",
      "De fora da área, o {team} tentou surpreender.",
      "Que bicicleta do {team}! Faltou pontaria.",
      "Chutou cruzado o {team}. Passou beijando a trave.",
      "Isolou. Dá pra ver a decepção no banco do {team}.",
    ],
    post: [
      "Na trave e na sobra também não entrou! Que dia do {team}...",
      "O poste salvou o goleiro! O {team} não acredita.",
      "Duas traves no mesmo lance! Futebol é cruel com o {team}.",
    ],
    chance: [
      "O {team} está com a faca nos dentes agora.",
      "Olha o espaço nas costas da zaga: o {team} viu!",
      "Trama bonita do {team}, tudo de primeira.",
      "A defesa está desarrumada e o {team} aproveita.",
      "Cruzamento na medida do {team}! Faltou o toque final.",
    ],
    corner: [
      "Escanteio curto do {team}? A zaga se assusta.",
      "Todos na área, inclusive o goleiro? Não, ainda não. Córner do {team}.",
      "Bola alçada pelo {team}. Confusão na pequena área.",
    ],
    sub: [
      "Muda a estratégia o {team}: entra gente de velocidade.",
      "O técnico do {team} tira o time do sufoco com essa mudança.",
      "Reforço no meio-campo do {team}.",
    ],
    foul: [
      "Falta dura do {team}. O árbitro conversa com o jogador.",
      "Puxou a camisa e o juiz viu. Falta do {team}.",
      "Interrompeu o contra-ataque: falta tática do {team}.",
    ],
    card: [
      "Reclamou demais e levou. Cartão no {team}.",
      "Terceira falta do mesmo jogador: amarelo no {team}.",
      "Agora tem que jogar com cuidado o {team}.",
    ],
    kickoff: [
      "Times perfilados, hino cantado: começa o jogo!",
      "Bola no centro, apito na boca: vai começar!",
    ],
    halftime: ["Quinze minutos para arrumar a casa.", "Vai terminando a primeira etapa."],
    fulltime: ["Está encerrado. O placar conta a história.", "Fim de jogo e muita coisa para analisar."],
  },
  en: {
    goal: [
      "Low and hard into the corner — {team}!",
      "A header, and it's in! {team} lead the way.",
      "Counter-attack, clinical finish. {team}!",
      "That changes everything for {team}.",
      "The keeper never moved. {team} score!",
    ],
    save: [
      "Great positioning from the {team} keeper.",
      "Spread himself well — {team} survive.",
      "Parried, and nobody followed in. Relief for {team}.",
    ],
    shot: [
      "High and wide from {team}. Heads in hands.",
      "An audacious effort from {team}!",
      "Curled just past the post by {team}.",
    ],
    post: ["Post, then safety! Cruel on {team}.", "Twice off the frame — {team} cannot believe it."],
    chance: [
      "{team} have the scent of blood now.",
      "Space in behind and {team} have spotted it.",
      "Lovely one-touch football from {team}.",
    ],
    corner: ["Short corner from {team}.", "Whipped in by {team} — chaos in the six-yard box."],
    sub: ["Pace introduced by {team}.", "{team} reinforce the midfield."],
    foul: ["Cynical foul from {team} to stop the break.", "Shirt pull — the referee saw it. {team}."],
    card: ["Dissent, and he's booked. {team}.", "Third foul by the same man — yellow for {team}."],
    kickoff: ["Anthems done, here we go!", "Ball on the spot — we're away."],
    halftime: ["Fifteen minutes to fix it.", "The first half winds down."],
    fulltime: ["It's finished. The scoreline tells the story.", "Full time, and plenty to digest."],
  },
  es: {
    goal: [
      "¡Raso al palo largo! ¡Gol del {team}!",
      "¡De cabeza y adentro! ¡Marca el {team}!",
      "¡Contragolpe letal del {team}!",
      "¡El portero ni se movió! ¡Gol del {team}!",
    ],
    save: [
      "¡Bien colocado el arquero del {team}!",
      "¡Se agrandó el portero del {team}!",
      "Rechazó y nadie llegó al rebote. ¡Uf, {team}!",
    ],
    shot: ["¡Por encima del travesaño, {team}!", "¡Qué atrevimiento del {team}!", "¡Rozó el palo del {team}!"],
    post: ["¡Al palo y afuera! Cruel para el {team}.", "¡Dos veces la madera! El {team} no lo cree."],
    chance: [
      "¡El {team} huele sangre!",
      "¡Espacio a la espalda de la defensa y el {team} lo vio!",
      "¡Toque y toque del {team}!",
    ],
    corner: ["Córner en corto del {team}.", "Centro del {team} y lío en el área chica."],
    sub: ["Entra velocidad en el {team}.", "El {team} refuerza el mediocampo."],
    foul: ["Falta táctica del {team}.", "Agarrón y el árbitro lo vio. {team}."],
    card: ["Protestó y ahí está la amarilla. {team}.", "Tercera falta del mismo: amarilla al {team}."],
    kickoff: ["¡Himnos cantados, comienza!", "Balón al centro: ¡arrancamos!"],
    halftime: ["Quince minutos para corregir.", "Se acaba la primera parte."],
    fulltime: ["Terminó. El marcador cuenta la historia.", "Final, y mucho para analizar."],
  },
};

/**
 * Entradas do narrador. Cada uma dá um tom diferente à mesma frase-base:
 * rotina, tensão, euforia, decepção e ironia.
 */
const LEAD_INS: Record<NarrationLang, string[]> = {
  pt: [
    "",
    "Olha o lance! ",
    "Atenção, torcedor! ",
    "Que momento! ",
    "No detalhe: ",
    "Preste atenção nisso: ",
    "Coração na mão: ",
    "E agora, senhoras e senhores: ",
    "Vai com tudo: ",
    "Quem diria... ",
  ],
  en: [
    "",
    "Watch this! ",
    "Listen to that crowd! ",
    "What a moment! ",
    "In a flash, ",
    "Hold your breath: ",
    "Well, well: ",
    "And now, ladies and gentlemen: ",
    "Here it comes: ",
    "You could feel it coming: ",
  ],
  es: [
    "",
    "¡Atención! ",
    "¡Mira la jugada! ",
    "¡Qué momento! ",
    "En un instante, ",
    "Aguanten la respiración: ",
    "Vaya, vaya: ",
    "Y ahora, señoras y señores: ",
    "Aquí viene: ",
    "Se venía venir: ",
  ],
};

/**
 * Cada frase-base ganha uma leitura editorial por entrada do narrador. Com o
 * repertório ampliado, cada idioma passa de 600 combinações sem entregar texto
 * livre ao endpoint de voz, preservando cache estável e segurança.
 */
function expandPack(lang: NarrationLang, pack: Pack): Pack {
  const leads = LEAD_INS[lang];
  const extra = EXTRA[lang];
  return Object.fromEntries(
    Object.entries(pack).map(([event, lines]) => {
      const all = [...lines, ...(extra[event as NarrationEvent] ?? [])];
      return [
        event,
        all.flatMap((line, index) =>
          leads.map((lead, style) => (style === index % leads.length ? line : `${lead}${line}`)),
        ),
      ];
    }),
  ) as Pack;
}

const PACKS: Record<NarrationLang, Pack> = {
  pt: expandPack("pt", PT),
  en: expandPack("en", EN),
  es: expandPack("es", ES),
};


export function lineCount(lang: NarrationLang, event: NarrationEvent): number {
  return PACKS[lang][event].length;
}

/** Monta a frase final. `variant` é o índice do modelo (permite cache estável). */
export function narrationLine(
  lang: NarrationLang,
  event: NarrationEvent,
  team: string,
  variant: number,
): string {
  const pool = PACKS[lang][event];
  const tpl = pool[Math.abs(variant) % pool.length] ?? pool[0]!;
  return tpl.replaceAll("{team}", team.trim() || "o time");
}
