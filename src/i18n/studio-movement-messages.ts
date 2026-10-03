import type { Lang } from "./locale-catalog";
const IDS =
  "idle walk run sprint accelerate decelerate curveRunLeft dribble sideStep backpedal pass passLong cross shotPower shotPlaced chip volley firstTime trap tackle slide block duel feint stepover cut elastico throwIn header diveLeft diveRight saveHigh save catch celebrate".split(
    " ",
  );
const ROWS: Partial<Record<Lang, string>> = {
  en: "Standing|Walking|Running|Sprinting|Acceleration|Braking and recovery|Changing direction|Ball dribbling|Side steps|Backpedalling|Pass|Long pass|Cross|Power shot|Placed shot|Chip shot|Volley|First-time shot|Ball control|Tackle|Sliding tackle|Defensive block|Physical duel|Feint|Step-over|Direction cut|Elastico|Throw-in|Header|Save to the left|Save to the right|High save|Frontal save|Goalkeeper catch|Celebration",
  es: "De pie|Caminata|Carrera|Sprint|Aceleración|Frenada y recuperación|Cambio de dirección|Conducción|Desplazamiento lateral|Retroceso|Pase|Pase largo|Centro|Disparo potente|Disparo colocado|Vaselina|Volea|Disparo de primera|Control del balón|Entrada|Entrada deslizante|Bloqueo defensivo|Duelo físico|Finta|Bicicleta|Recorte|Elástica|Saque de banda|Cabezazo|Parada a la izquierda|Parada a la derecha|Parada alta|Parada frontal|Agarre del portero|Celebración",
  fr: "Debout|Marche|Course|Sprint|Accélération|Freinage et reprise|Changement de direction|Conduite de balle|Pas latéraux|Course arrière|Passe|Passe longue|Centre|Frappe puissante|Frappe placée|Lob|Volée|Frappe de première|Contrôle de balle|Tacle|Tacle glissé|Bloc défensif|Duel physique|Feinte|Passement de jambes|Crochet|Elastico|Touche|Tête|Arrêt à gauche|Arrêt à droite|Arrêt aérien|Arrêt frontal|Prise du gardien|Célébration",
  de: "Stehen|Gehen|Laufen|Sprint|Beschleunigung|Abbremsen und Erholung|Richtungswechsel|Dribbling|Seitwärtsschritte|Rückwärtslauf|Pass|Langer Pass|Flanke|Kraftvoller Schuss|Platzierter Schuss|Lupfer|Volley|Direktschuss|Ballannahme|Zweikampf|Grätsche|Abwehrblock|Körperduell|Finte|Übersteiger|Haken|Elastico|Einwurf|Kopfball|Parade links|Parade rechts|Hohe Parade|Frontale Parade|Ball fangen|Jubel",
};
export function studioMovementLabel(lang: Lang, id: string, portuguese: string): string {
  if (lang.startsWith("pt")) return portuguese;
  return (ROWS[lang] ?? ROWS.en!).split("|")[IDS.indexOf(id)] ?? portuguese;
}
