/**
 * Small client-side profanity/abuse filter for chat messages.
 * This is intentionally lightweight — a best-effort deterrent, not a
 * substitute for server-side moderation of the `chat_messages` table.
 */

const BLOCKED_TERMS = [
  // pt-BR
  "arrombado",
  "babaca",
  "bicha",
  "bosta",
  "buceta",
  "burro",
  "caralho",
  "corno",
  "cuzao",
  "cuzão",
  "desgraça",
  "filho da puta",
  "fdp",
  "foda-se",
  "gay" /* used as slur context */,
  "idiota",
  "imbecil",
  "merda",
  "otario",
  "otário",
  "pau no cu",
  "porra",
  "puta",
  "retardado",
  "vadia",
  "viado",
  "vsf",
  // en
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "cunt",
  "damn",
  "dick",
  "fuck",
  "idiot",
  "nigger",
  "nigga",
  "piss",
  "retard",
  "shit",
  "slut",
  "whore",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Returns true when the given text contains a term from the block list. */
export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  return BLOCKED_TERMS.some((term) => normalized.includes(normalize(term)));
}

/** Human-friendly pt-BR message to show when a message is blocked. */
export const PROFANITY_BLOCKED_MESSAGE =
  "Sua mensagem contém termos não permitidos no chat. Ajuste o texto e tente novamente.";
