/** Transforma erros técnicos da IA em texto claro para o jogador. */
export function aiErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/unauthorized/i.test(raw) || /401/.test(raw)) {
    return "Entre na sua conta para usar os recursos de inteligência artificial.";
  }
  return raw || "A IA não conseguiu responder agora. Tente novamente.";
}
