/**
 * Chat moderation rules shared by the browser (instant feedback) and the
 * server (authoritative check in `sendChatMessage`). The server result is the
 * only one that matters: the browser copy can be bypassed.
 */

const BLOCKED_TERMS = [
  // pt-BR
  "arrombado",
  "babaca",
  "bosta",
  "buceta",
  "caralho",
  "corno",
  "cuzao",
  "desgraca",
  "filho da puta",
  "fdp",
  "foda se",
  "imbecil",
  "merda",
  "otario",
  "pau no cu",
  "porra",
  "puta",
  "retardado",
  "vadia",
  "viado",
  "vsf",
  "macaco",
  // es
  "pendejo",
  "cabron",
  "hijo de puta",
  "mierda",
  "maricon",
  // en
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "dick",
  "fuck",
  "nigger",
  "nigga",
  "retard",
  "shit",
  "slut",
  "whore",
];

/** Leetspeak and look-alike characters people use to slip past filters. */
const LOOKALIKES: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
};

/** Lowercase, strip accents and map look-alike characters to letters. */
export function normalizeForModeration(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[0-9@$]/g, (c) => LOOKALIKES[c] ?? c);
}

/** Letters only, with runs of the same letter collapsed ("poorrraaa" -> "pora"). */
function squash(text: string): string {
  return text.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

/** Words split on anything that is not a letter, each squashed. */
function words(text: string): string[] {
  return text
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map((w) => w.replace(/(.)\1+/g, "$1"));
}

const SQUASHED_TERMS = BLOCKED_TERMS.map((t) => squash(normalizeForModeration(t)));
const SINGLE_WORD_TERMS = new Set(SQUASHED_TERMS.filter((_, i) => !BLOCKED_TERMS[i]?.includes(" ")));
const PHRASE_TERMS = SQUASHED_TERMS.filter((_, i) => BLOCKED_TERMS[i]?.includes(" "));
/** Long terms are matched even when glued to other letters or split by dots. */
const MIN_EMBEDDED_LENGTH = 5;

/** True when the text contains a blocked term, including disguised spellings. */
export function containsProfanity(text: string): boolean {
  const normalized = normalizeForModeration(text);
  // Whole words: "porra", "p0rr4", "poooorra".
  if (words(normalized).some((w) => SINGLE_WORD_TERMS.has(w))) return true;
  // Letter-by-letter spellings: "p.o.r.r.a", "p o r r a".
  const spelled = normalized.match(/(?:\b[a-z]\b[^a-z]*){3,}/g) ?? [];
  if (spelled.some((run) => SINGLE_WORD_TERMS.has(squash(run)))) return true;
  // Phrases and glued spellings: "filho-da-puta", "seucaralho".
  const glued = squash(normalized);
  if (PHRASE_TERMS.some((t) => glued.includes(t))) return true;
  return SQUASHED_TERMS.some((t) => t.length >= MIN_EMBEDDED_LENGTH && glued.includes(t));
}

export type ModerationReason = "profanity" | "link" | "contact" | "shouting" | "repeated";

const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|xyz|br|me|ly|app)\b|discord\.gg)/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** Eight or more digits, allowing spaces, dots, dashes and parentheses between them. */
const PHONE = /(?:\d[\s().-]?){8,}/;

/** Minimum letters before the all-caps rule applies, so "GOL!" is allowed. */
const SHOUTING_MIN_LETTERS = 12;

/**
 * Checks one message. Returns the first rule it breaks, or null when allowed.
 * `previous` holds the sender's recent messages for the repeat rule.
 */
export function moderateMessage(
  text: string,
  previous: readonly string[] = [],
): ModerationReason | null {
  if (containsProfanity(text)) return "profanity";
  if (EMAIL.test(text) || PHONE.test(text)) return "contact";
  if (LINK.test(text)) return "link";
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (
    letters.length >= SHOUTING_MIN_LETTERS &&
    letters === letters.toUpperCase() &&
    letters !== letters.toLowerCase()
  )
    return "shouting";
  const key = squash(normalizeForModeration(text));
  if (key && previous.some((p) => squash(normalizeForModeration(p)) === key)) return "repeated";
  return null;
}

/** Human-friendly pt-BR messages for each blocked reason. */
export const MODERATION_MESSAGES: Record<ModerationReason, string> = {
  profanity: "Sua mensagem contém termos não permitidos no chat. Ajuste o texto e tente novamente.",
  link: "Links não são permitidos no chat, para proteger os jogadores contra golpes.",
  contact: "Não compartilhe telefone ou e-mail no chat. Seus dados ficam mais seguros assim.",
  shouting: "Escreva sem usar só letras maiúsculas.",
  repeated: "Você já enviou essa mensagem. Evite repetir.",
};

export const PROFANITY_BLOCKED_MESSAGE = MODERATION_MESSAGES.profanity;
