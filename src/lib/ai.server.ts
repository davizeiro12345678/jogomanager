// Server-only helper: talks to Gemini via the Lovable AI Gateway.
// Never import this from client components — it reads a secret env var.

export type AiErrorKind = "rate_limit" | "no_credits" | "unknown";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "AiError";
  }
}

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

/**
 * Chama o Gemini pelo Lovable AI Gateway. `system` define o papel/persona e
 * já deve pedir respostas curtas (o gateway não aceita `max_tokens` fixo).
 */
export async function callGemini(system: string, user: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new AiError("unknown", "IA indisponível no momento. Tente novamente mais tarde.");
  }

  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch {
    throw new AiError("unknown", "Não foi possível falar com a IA agora. Tente novamente.");
  }

  if (res.status === 429) {
    throw new AiError("rate_limit", "Limite de uso da IA atingido, tente em instantes.");
  }
  if (res.status === 402) {
    throw new AiError("no_credits", "Créditos de IA esgotados. Fale com o administrador do jogo.");
  }
  if (!res.ok) {
    throw new AiError("unknown", "A IA não conseguiu responder agora. Tente novamente.");
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiError("unknown", "A IA respondeu vazio. Tente novamente.");
  }
  return text;
}
