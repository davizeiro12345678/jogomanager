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
  | "chance"
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
  ],
  save: [
    "PEGOOOU! Que defesaça do goleiro do {team}!",
    "Espalmou! O goleiro do {team} salvou o time!",
    "MILAGRE! Defesa absurda do {team}!",
  ],
  shot: [
    "Chutou o {team}! Passou perto!",
    "Arriscou de fora da área o {team}!",
    "Finaliza o {team}, e o goleiro leva perigo!",
  ],
  post: ["NA TRAVE! O {team} quase marcou!", "Explodiu no poste! Que azar do {team}!"],
  chance: ["Perigo! O {team} chega com tudo!", "Que jogada do {team}! O ataque desceu bonito!"],
  foul: ["Faltou o {team}. O árbitro marca.", "Parou o lance: falta do {team}."],
  card: [
    "Cartão para o {team}! O árbitro não perdoou.",
    "Vai anotar! Cartão para o jogador do {team}.",
  ],
  kickoff: ["A BOLA VAI ROLAR! Começa o jogo!", "Apitou o árbitro: começa a partida!"],
  halftime: ["Fim do primeiro tempo. Que jogo!", "Vamos para o intervalo."],
  fulltime: ["ACABOU! Fim de jogo!", "Apita o árbitro: está encerrada a partida!"],
};

const EN: Pack = {
  goal: [
    "GOAL! What a strike from {team}!",
    "IT'S IN! {team} find the net!",
    "OH, THAT IS BRILLIANT! Goal for {team}!",
    "The stadium erupts — {team} score!",
  ],
  save: ["WHAT A SAVE! The {team} keeper is on fire!", "Superb stop! {team} survive that one!"],
  shot: ["{team} let fly — just wide!", "A crack at goal from {team}!"],
  post: ["OFF THE WOODWORK! So close for {team}!", "The post denies {team}!"],
  chance: ["Danger here! {team} pour forward!", "Lovely move from {team}!"],
  foul: ["Foul given against {team}.", "The whistle goes — {team} in the book's direction."],
  card: ["A card for {team}!", "The referee reaches for his pocket — {team}."],
  kickoff: ["We are underway!", "Kick-off! Here we go!"],
  halftime: ["That's half-time.", "The whistle goes for the break."],
  fulltime: ["FULL TIME! It's all over!", "The referee ends it here!"],
};

const ES: Pack = {
  goal: [
    "¡GOOOOL DEL {team}! ¡Qué golazo!",
    "¡LA CLAVÓ! ¡Gol del {team}!",
    "¡NO LO PUEDO CREER! ¡Marca el {team}!",
  ],
  save: ["¡QUÉ PARADÓN del portero del {team}!", "¡Enorme atajada del {team}!"],
  shot: ["¡Remata el {team}! ¡Se fue cerca!", "¡Prueba desde lejos el {team}!"],
  post: ["¡AL PALO! ¡Casi el {team}!", "¡El travesaño le dice que no al {team}!"],
  chance: ["¡Peligro! ¡Ataca el {team}!", "¡Qué jugada del {team}!"],
  foul: ["Falta del {team}.", "El árbitro pita falta del {team}."],
  card: ["¡Tarjeta para el {team}!", "El árbitro amonesta al {team}."],
  kickoff: ["¡Rueda el balón! ¡Comienza el partido!", "¡Arrancó el juego!"],
  halftime: ["Final del primer tiempo.", "Nos vamos al descanso."],
  fulltime: ["¡SE ACABÓ! ¡Final del partido!", "¡El árbitro decreta el final!"],
};

const PACKS: Record<NarrationLang, Pack> = { pt: PT, en: EN, es: ES };

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
