// Server-only Claude Messages client. Never import this from client components:
// credentials stay in the server runtime and a caller only receives visible text.
//
// Personas remain product policy, while this module owns the provider protocol.
// It deliberately has no Chat Completions fallback: a misconfigured migration
// must fail closed instead of silently calling a different model or API shape.

export type AiErrorKind = "rate_limit" | "no_credits" | "unavailable" | "unknown";

export class AiError extends Error {
  kind: AiErrorKind;
  constructor(kind: AiErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "AiError";
  }
}

/** The exact native Claude API model selected for the product. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
export const DEFAULT_ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
/**
 * `max_tokens` covers adaptive thinking and the visible answer. 512 can leave
 * an effort=max request with no visible response, so use the native API's
 * documented 4k baseline while the product prompt keeps answers concise.
 */
export const DEFAULT_MAX_TOKENS = 4_096;
export const MAX_AI_MESSAGES = 24;
export const MAX_AI_SYSTEM_CHARS = 6_000;
export const MAX_AI_MESSAGE_CHARS = 6_000;
export const MAX_AI_CONVERSATION_CHARS = 18_000;
export const MAX_AI_VISIBLE_RESPONSE_CHARS = 6_000;
/** Bound malformed/proxied SSE frames before an unframed payload grows memory. */
export const MAX_AI_SSE_BUFFER_CHARS = 96_000;
/** Bound a non-streaming Messages fallback before JSON parsing it. */
export const MAX_AI_RESPONSE_BODY_BYTES = 1_000_000;

export type Persona = "luna" | "sol";

const PERSONA_PREFIX: Record<Persona, string> = {
  luna:
    "Você é Luna, assistente do jogo Pro Football Manager 3D. Responda em português do Brasil, " +
    "em no máximo 3 pontos curtos e acionáveis. Use vocabulário real de futebol sul-americano e europeu, " +
    "como bloco baixo, pressão pós-perda, cobertura, entrelinhas e transição rápida pelas pontas, quando fizer sentido. " +
    "Baseie cada conselho somente nos dados reais do save recebidos. Nunca invente contratações, escalações ou gastos já realizados: " +
    "você apenas sugere, e qualquer ação depende de o técnico confirmar no jogo.",
  sol:
    "Você é Sol, assistente do jogo Pro Football Manager 3D para jogadores jovens. Responda em " +
    "português do Brasil, com no máximo 3 pontos, frases curtas e simples, usando somente os dados do save. Nada de violência, apostas, álcool, " +
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

export interface AnthropicConfig {
  apiKey: string;
  url: string;
  model: string;
  version: string;
}

type Environment = Record<string, string | undefined>;

/**
 * Resolves only the explicit Anthropic Messages configuration. Keeping the
 * legacy OpenAI-compatible variables out of this path prevents accidental
 * provider fallback after migration.
 */
export function resolveAnthropicConfig(env: Environment = process.env): AnthropicConfig {
  const apiKey = env["ANTHROPIC_API_KEY"]?.trim();
  const url = (env["ANTHROPIC_MESSAGES_URL"] ?? DEFAULT_ANTHROPIC_MESSAGES_URL).trim();
  const model = (env["ANTHROPIC_MODEL"] ?? DEFAULT_ANTHROPIC_MODEL).trim();
  const version = (env["ANTHROPIC_VERSION"] ?? DEFAULT_ANTHROPIC_VERSION).trim();

  if (!apiKey) {
    throw new AiError("unavailable", "IA indisponível no momento. Tente novamente mais tarde.");
  }
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "api.anthropic.com" ||
      (parsed.port && parsed.port !== "443") ||
      parsed.pathname !== "/v1/messages" ||
      parsed.search ||
      parsed.hash ||
      parsed.username ||
      parsed.password
    )
      throw new Error();
  } catch {
    throw new AiError(
      "unavailable",
      "A configuração da IA está incompleta. Tente novamente mais tarde.",
    );
  }
  // This client sends a native Anthropic key, so a gateway-style model name or
  // arbitrary endpoint must fail before it can send that credential elsewhere.
  if (model !== DEFAULT_ANTHROPIC_MODEL || !version) {
    throw new AiError(
      "unavailable",
      "A configuração da IA está incompleta. Tente novamente mais tarde.",
    );
  }
  return { apiKey, url, model, version };
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  stream: true;
  thinking: { type: "adaptive" };
  output_config: { effort: "max" };
}

/** Reject invalid or unexpectedly large direct callers before a budget slot is
 * reserved or a request is sent to the provider. */
export function assertAiMessageBudget(messages: readonly ChatMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_AI_MESSAGES) {
    throw new AiError("unknown", "A IA não recebeu uma conversa válida. Tente novamente.");
  }

  let systemChars = 0;
  let conversationChars = 0;
  let hasUser = false;
  for (const message of messages) {
    if (
      !message ||
      typeof message !== "object" ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      message.content.trim().length === 0 ||
      message.content.length > MAX_AI_MESSAGE_CHARS
    ) {
      throw new AiError("unknown", "A IA não recebeu uma conversa válida. Tente novamente.");
    }
    if (message.role === "system") systemChars += message.content.length;
    else conversationChars += message.content.length;
    if (message.role === "user") hasUser = true;
  }

  if (
    !hasUser ||
    systemChars > MAX_AI_SYSTEM_CHARS ||
    conversationChars > MAX_AI_CONVERSATION_CHARS
  ) {
    throw new AiError("unknown", "A IA não recebeu uma conversa válida. Tente novamente.");
  }
}

/** Converts our existing system/user history into the native Messages shape. */
export function buildAnthropicMessagesRequest(
  messages: ChatMessage[],
  config: Pick<AnthropicConfig, "model">,
): AnthropicRequest {
  assertAiMessageBudget(messages);
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const conversation = messages
    .filter(
      (message): message is ChatMessage & { role: "user" | "assistant" } =>
        message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({ role: message.role, content: message.content }));

  if (!conversation.some((message) => message.role === "user")) {
    throw new AiError("unknown", "A IA não recebeu uma pergunta válida. Tente novamente.");
  }

  return {
    model: config.model,
    max_tokens: DEFAULT_MAX_TOKENS,
    ...(system ? { system } : {}),
    messages: conversation,
    stream: true,
    thinking: { type: "adaptive" },
    output_config: { effort: "max" },
  };
}

type AnthropicTextBlock = { type?: unknown; text?: unknown };

/** Extracts only user-visible text, never adaptive-thinking blocks. */
export function extractAnthropicText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (block): block is AnthropicTextBlock =>
        !!block && typeof block === "object" && (block as AnthropicTextBlock).type === "text",
    )
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("");
}

function textFromSsePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const value = payload as {
    type?: unknown;
    delta?: { type?: unknown; text?: unknown };
    content_block?: { type?: unknown; text?: unknown };
  };
  if (value.type === "content_block_delta" && value.delta?.type === "text_delta") {
    return typeof value.delta.text === "string" ? value.delta.text : "";
  }
  if (value.type === "content_block_start" && value.content_block?.type === "text") {
    return typeof value.content_block.text === "string" ? value.content_block.text : "";
  }
  return "";
}

function eventPayload(frame: string): unknown {
  const source = frame
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!source || source === "[DONE]") return undefined;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    return undefined;
  }
}

/** Decodes native Messages Server-Sent Events without exposing thinking text. */
export async function* readAnthropicTextStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let emittedChars = 0;
  let completed = false;

  const consume = function* (final = false): Generator<string> {
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = final ? "" : (parts.pop() ?? "");
    for (const part of final ? parts.filter(Boolean) : parts) {
      const text = textFromSsePayload(eventPayload(part));
      if (text) yield text;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > MAX_AI_SSE_BUFFER_CHARS) {
        throw new AiError(
          "unknown",
          "A transmissão da IA excedeu o limite seguro. Tente novamente.",
        );
      }
      const decoded = decoder.decode(value, { stream: true });
      if (decoded.length > MAX_AI_SSE_BUFFER_CHARS - buffer.length) {
        throw new AiError(
          "unknown",
          "A transmissão da IA excedeu o limite seguro. Tente novamente.",
        );
      }
      buffer += decoded;
      for (const text of consume()) {
        emittedChars += text.length;
        if (emittedChars > MAX_AI_VISIBLE_RESPONSE_CHARS) {
          throw new AiError("unknown", "A IA respondeu além do limite seguro. Tente novamente.");
        }
        yield text;
      }
    }
    const finalChunk = decoder.decode();
    if (finalChunk.length > MAX_AI_SSE_BUFFER_CHARS - buffer.length) {
      throw new AiError("unknown", "A transmissão da IA excedeu o limite seguro. Tente novamente.");
    }
    buffer += finalChunk;
    for (const text of consume(true)) {
      emittedChars += text.length;
      if (emittedChars > MAX_AI_VISIBLE_RESPONSE_CHARS) {
        throw new AiError("unknown", "A IA respondeu além do limite seguro. Tente novamente.");
      }
      yield text;
    }
    completed = true;
  } finally {
    if (!completed) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}

/**
 * Proxies occasionally buffer a compliant Messages response instead of
 * preserving SSE. Read that fallback with a strict byte cap instead of calling
 * `response.json()` on an unbounded body.
 */
export async function readBoundedAnthropicJson(
  response: Pick<Response, "body" | "headers">,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AI_RESPONSE_BODY_BYTES) {
    throw new AiError("unknown", "A resposta da IA excedeu o limite seguro. Tente novamente.");
  }
  if (!response.body) {
    throw new AiError("unknown", "A IA não conseguiu responder agora. Tente novamente.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AI_RESPONSE_BODY_BYTES) {
        throw new AiError("unknown", "A resposta da IA excedeu o limite seguro. Tente novamente.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    completed = true;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new AiError("unknown", "A IA não conseguiu responder agora. Tente novamente.");
    }
  } finally {
    if (!completed) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}

function responseError(status: number) {
  if (status === 429) {
    return new AiError("rate_limit", "Limite de uso da IA atingido, tente em instantes.");
  }
  if (status === 402) {
    return new AiError("no_credits", "Créditos de IA esgotados. Fale com o administrador do jogo.");
  }
  return new AiError("unknown", "A IA não conseguiu responder agora. Tente novamente.");
}

/**
 * Native streaming transport. Consumers that can render deltas may consume this
 * generator directly; existing server functions still aggregate it through
 * callModel so their public response contract remains stable.
 */
export async function* callModelStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const config = resolveAnthropicConfig();
  const request = buildAnthropicMessagesRequest(messages, config);

  // The monthly budget remains a prerequisite; no request is sent on refusal.
  const { reserveAiBudget } = await import("@/lib/ai-budget.server");
  if (!(await reserveAiBudget("text"))) {
    throw new AiError("no_credits", "O limite de IA deste mês foi atingido. Volte no mês que vem.");
  }

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": config.version,
        "content-type": "application/json",
        accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      // No artificial fixed timeout: callers may cancel their own request, and
      // streaming prevents a long valid answer from being killed at 30 seconds.
    });
  } catch {
    throw new AiError("unknown", "Não foi possível falar com a IA agora. Tente novamente.");
  }

  if (!response.ok) throw responseError(response.status);

  if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
    yield* readAnthropicTextStream(response.body);
    return;
  }

  // This fallback supports compliant proxies that buffer Messages responses.
  const text = extractAnthropicText(await readBoundedAnthropicJson(response));
  if (text.length > MAX_AI_VISIBLE_RESPONSE_CHARS) {
    throw new AiError("unknown", "A IA respondeu além do limite seguro. Tente novamente.");
  }
  if (text) yield text;
}

/** Aggregates native streaming for existing server-function consumers. */
export async function callModel(messages: ChatMessage[]): Promise<string> {
  let text = "";
  for await (const delta of callModelStream(messages)) text += delta;
  const answer = text.trim();
  if (!answer) {
    throw new AiError("unknown", "A IA respondeu vazio. Tente novamente.");
  }
  return answer;
}

/** Point of entry used by existing game endpoints. */
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
