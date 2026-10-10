import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-budget.server", () => ({
  reserveAiBudget: vi.fn(),
}));

import {
  buildAnthropicMessagesRequest,
  callModel,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_MAX_TOKENS,
  extractAnthropicText,
  MAX_AI_RESPONSE_BODY_BYTES,
  MAX_AI_SSE_BUFFER_CHARS,
  MAX_AI_VISIBLE_RESPONSE_CHARS,
  readBoundedAnthropicJson,
  readAnthropicTextStream,
  resolveAnthropicConfig,
} from "./ai.server";
import { reserveAiBudget } from "./ai-budget.server";

async function* chunks(values: string[]) {
  const encoder = new TextEncoder();
  for (const value of values) yield encoder.encode(value);
}

function stream(values: string[]) {
  const iterator = chunks(values);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
  });
}

const originalAnthropicEnvironment = {
  apiKey: process.env["ANTHROPIC_API_KEY"],
  url: process.env["ANTHROPIC_MESSAGES_URL"],
  model: process.env["ANTHROPIC_MODEL"],
  version: process.env["ANTHROPIC_VERSION"],
};

function restoreEnvironment(name: keyof typeof originalAnthropicEnvironment) {
  const value = originalAnthropicEnvironment[name];
  if (value === undefined)
    delete process.env[
      name === "apiKey"
        ? "ANTHROPIC_API_KEY"
        : name === "url"
          ? "ANTHROPIC_MESSAGES_URL"
          : name === "model"
            ? "ANTHROPIC_MODEL"
            : "ANTHROPIC_VERSION"
    ];
  else
    process.env[
      name === "apiKey"
        ? "ANTHROPIC_API_KEY"
        : name === "url"
          ? "ANTHROPIC_MESSAGES_URL"
          : name === "model"
            ? "ANTHROPIC_MODEL"
            : "ANTHROPIC_VERSION"
    ] = value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  restoreEnvironment("apiKey");
  restoreEnvironment("url");
  restoreEnvironment("model");
  restoreEnvironment("version");
});

describe("native Claude Messages client", () => {
  it("uses the chosen model with adaptive thinking, max effort, and no Chat Completions shape", () => {
    const request = buildAnthropicMessagesRequest(
      [
        { role: "system", content: "Sempre responda em português." },
        { role: "user", content: "Como está o elenco?" },
        { role: "assistant", content: "Vou analisar." },
      ],
      { model: DEFAULT_ANTHROPIC_MODEL },
    );

    expect(request).toMatchObject({
      model: "claude-opus-5-5",
      system: "Sempre responda em português.",
      messages: [
        { role: "user", content: "Como está o elenco?" },
        { role: "assistant", content: "Vou analisar." },
      ],
      stream: true,
      thinking: { type: "adaptive" },
      output_config: { effort: "max" },
    });
    expect("choices" in request).toBe(false);
    expect(request.max_tokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("requires an explicit native Messages endpoint and does not reuse legacy chat settings", () => {
    expect(() => resolveAnthropicConfig({ AI_API_KEY: "legacy" })).toThrow("IA indisponível");
    expect(() =>
      resolveAnthropicConfig({
        ANTHROPIC_API_KEY: "key",
        ANTHROPIC_MESSAGES_URL: "https://provider.example/v1/messages",
      }),
    ).toThrow("configuração da IA");
    expect(() =>
      resolveAnthropicConfig({
        ANTHROPIC_API_KEY: "key",
        ANTHROPIC_MODEL: "anthropic/claude-opus-5-5",
      }),
    ).toThrow("configuração da IA");
    expect(resolveAnthropicConfig({ ANTHROPIC_API_KEY: "key" }).model).toBe(
      DEFAULT_ANTHROPIC_MODEL,
    );
  });

  it("forwards visible text while excluding thinking from Messages payloads and SSE", async () => {
    expect(
      extractAnthropicText({
        content: [
          { type: "thinking", thinking: "private" },
          { type: "text", text: "Resposta útil" },
        ],
      }),
    ).toBe("Resposta útil");

    const received: string[] = [];
    for await (const text of readAnthropicTextStream(
      stream([
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"private"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Linha "}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"final"}}\n\n',
      ]),
    )) {
      received.push(text);
    }
    expect(received.join("")).toBe("Linha final");
  });

  it("rejects oversized input and streamed output before it can create unbounded provider work", async () => {
    expect(() =>
      buildAnthropicMessagesRequest([{ role: "user", content: "x".repeat(6_001) }], {
        model: DEFAULT_ANTHROPIC_MODEL,
      }),
    ).toThrow("conversa válida");

    const frame = `event: content_block_delta\ndata: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "x".repeat(MAX_AI_VISIBLE_RESPONSE_CHARS + 1) },
    })}\n\n`;
    await expect(async () => {
      for await (const _ of readAnthropicTextStream(stream([frame]))) {
        // Consume the whole controlled stream.
      }
    }).rejects.toThrow("além do limite seguro");
  });

  it("bounds unframed SSE and buffered JSON responses before parsing", async () => {
    await expect(async () => {
      for await (const _ of readAnthropicTextStream(
        stream([`data: ${"x".repeat(MAX_AI_SSE_BUFFER_CHARS)}`]),
      )) {
        // Consume the malformed stream.
      }
    }).rejects.toThrow("transmissão da IA excedeu");

    await expect(
      readBoundedAnthropicJson(
        new Response("{}", {
          headers: { "content-length": String(MAX_AI_RESPONSE_BODY_BYTES + 1) },
        }),
      ),
    ).rejects.toThrow("resposta da IA excedeu");

    await expect(
      readBoundedAnthropicJson(
        new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }] })),
      ),
    ).resolves.toEqual({ content: [{ type: "text", text: "ok" }] });
  });

  it("reserves the budget before a native Messages request and never sends gateway settings", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-key";
    vi.mocked(reserveAiBudget).mockResolvedValue(true);
    const requests: { url: RequestInfo | URL; init: RequestInit | undefined }[] = [];
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url, init });
      return new Response(
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Resposta"}}\n\n',
        { headers: { "content-type": "text/event-stream" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(callModel([{ role: "user", content: "Tática?" }])).resolves.toBe("Resposta");

    expect(reserveAiBudget).toHaveBeenCalledWith("text");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requests[0];
    expect(request?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(request?.init).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        "x-api-key": "test-key",
        "anthropic-version": "2023-06-01",
      }),
    });
    expect(JSON.parse(String(request?.init?.body))).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: DEFAULT_MAX_TOKENS,
      output_config: { effort: "max" },
      thinking: { type: "adaptive" },
    });
  });

  it("does not call the provider when budget reservation refuses", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-key";
    vi.mocked(reserveAiBudget).mockResolvedValue(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(callModel([{ role: "user", content: "Tática?" }])).rejects.toThrow(
      "limite de IA deste mês",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
