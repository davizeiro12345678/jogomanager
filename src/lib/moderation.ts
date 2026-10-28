/**
 * A bounded, deterministic first layer for chat. The server runs this before
 * inserting a message; the browser also uses it for immediate feedback. It is
 * not a substitute for contextual moderation or human review.
 */

const BLOCKED_TERMS = [
  "arrombado",
  "babaca",
  "bicha",
  "bosta",
  "buceta",
  "burro",
  "caralho",
  "corno",
  "cuzao",
  "desgraca",
  "fdp",
  "foda",
  "idiota",
  "imbecil",
  "merda",
  "otario",
  "porra",
  "puta",
  "retardado",
  "vadia",
  "viado",
  "vsf",
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

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };
const CONFUSABLE: Record<string, string> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  у: "y",
  х: "x",
  і: "i",
};

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .toLowerCase()
    .replace(
      /[013457аеорсухі]/g,
      (character) => LEET[character] ?? CONFUSABLE[character] ?? character,
    );
}

function collapseRepetitions(word: string): string {
  return word.replace(/(.)\1+/g, "$1");
}

const BLOCKED_WORDS = new Set(
  BLOCKED_TERMS.flatMap((term) => normalize(term).match(/[\p{L}\p{N}]+/gu) ?? []).map(
    collapseRepetitions,
  ),
);

/**
 * Exact words avoid blocking substrings such as "disputa" and Scunthorpe.
 * Single-letter runs catch common punctuation/spacing evasion. Identity
 * terms alone are not considered abusive; selected explicit threats and
 * incitements are checked as phrases.
 */
export function containsProfanity(text: string): boolean {
  const words = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.some((word) => BLOCKED_WORDS.has(collapseRepetitions(word)))) return true;

  let letters = "";
  for (const word of [...words, ""]) {
    if (word.length === 1) letters += word;
    else {
      if (letters.length >= 3 && BLOCKED_WORDS.has(collapseRepetitions(letters))) return true;
      letters = "";
    }
  }

  const phrase = words.join(" ");
  if (/\bpau no cu\b/.test(phrase)) return true;
  const threat =
    /\b(?:vou|vamos|irei) (?:te (?:matar|esfaquear|atirar)|(?:matar|esfaquear) (?:voce|voces|vc))\b|\b(?:i will|ill|im going to) (?:kill|stab|shoot) you\b/;
  const incitement =
    /\b(?:gays?|negros?|negras?|judeus?|muculmanos?|imigrantes?) (?:merecem|devem|precisam) morrer\b|\bkill all (?:gays|black people|jews|muslims|immigrants)\b/;
  return threat.test(phrase) || incitement.test(phrase);
}

export const PROFANITY_BLOCKED_MESSAGE =
  "Sua mensagem contém termos não permitidos no chat. Ajuste o texto e tente novamente.";
