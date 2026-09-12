// Server-only helper: talks to the text model through the Lovable AI Gateway.
// Never import this from client components — it reads a secret env var.
//
// O provedor é trocável: `callModel` é o único ponto que conhece o gateway e o
// identificador do modelo. Personas: Luna (contas adultas) e Sol (contas
// supervisionadas, linguagem mais simples e sem assuntos sensíveis).

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
const MODEL = "openai/gpt-6-astra";

export type Persona = "luna" | "sol";

const PERSONA_PREFIX: Record<Persona, string> = {
  luna:
    "Você é Luna, assistente do jogo Pro Football Manager 3D. Responda em português do Brasil, " +
    "de forma direta e curta. Nunca invente contratações, escalações ou gastos já realizados: " +
    "você apenas sugere, e qualquer ação depende de o técnico confirmar no jogo.",
  sol:
    "Você é Sol, assistente do jogo Pro Football Manager 3D para jogadores jovens. Responda em " +
    "português do Brasil, com frases curtas e simples. Nada de violência, apostas, álcool, " +
    "linguagem adulta ou pedidos de dados pessoais. Você apenas sugere: nenhuma contratação, " +
    "escalação ou gasto acontece sem o jogador confirmar no jogo.",
};

/** Junta a persona ao papel específico daquele pedido. */
export function withPersona(persona: Persona, system: string): string {
  return `${PERSONA_PREFIX[persona]}\n\n${system}`;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Chamada crua ao gateway. Trocar de provedor significa trocar só esta função. */
export async function callModel(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    throw new AiError("unknown", "IA indisponível no momento. Tente novamente mais tarde.");
  }

  // Teto mensal de gasto: reserva antes de gerar custo.
  const { reserveAiBudget } = await import("@/lib/ai-budget.server");
  if (!(await reserveAiBudget("text"))) {
    throw new AiError("no_credits", "O limite de IA deste mês foi atingido. Volte no mês que vem.");
  }

  let res: Response;
  try {
    res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: MODEL, messages }),
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

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new AiError("unknown", "A IA respondeu vazio. Tente novamente.");
  }
  return text;
}

/**
 * Ponto de entrada usado pelos endpoints do jogo. Mantém o nome antigo para não
 * quebrar chamadas existentes, mas agora roda no modelo configurado acima com a
 * persona escolhida.
 */
export async function callAi(
  system: string,
  user: string,
  persona: Persona = "luna",
): Promise<string> {
  return callModel([
    { role: "system", content: withPersona(persona, system) },
    { role: "user", content: user },
  ]);
}

/** @deprecated use `callAi` */
export const callGemini = callAi;
