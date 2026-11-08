import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ Link: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useCareer", () => ({ useSignedIn: () => false }));
vi.mock("@/lib/chat.functions", () => ({ sendChatMessage: vi.fn() }));
vi.mock("@/lib/community.functions", () => ({ reportChatMessage: vi.fn() }));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/components/ui/textarea", () => ({ Textarea: () => null }));
vi.mock("./screen-kit", () => ({
  EmptyState: () => null,
  ErrorPanel: () => null,
  SkeletonRows: () => null,
}));

import { ChatPanel } from "./ChatPanel";

const feedbackContracts = ChatPanel as typeof ChatPanel & {
  chatConnectionMessage: (status: "connecting" | "connected" | "disconnected") => string;
  chatSendFailureMessage: (
    result: {
      ok: false;
      reason: "blocked" | "muted" | "rate_limited" | "invalid_length" | "error";
      message?: string;
    } | null,
  ) => string;
};

describe("ChatPanel feedback contracts", () => {
  it("describes connection lifecycle without claiming durable delivery", () => {
    expect(feedbackContracts.chatConnectionMessage("connecting")).toBe("Conectando ao chat…");
    expect(feedbackContracts.chatConnectionMessage("disconnected")).toBe(
      "A conexão do chat caiu. Tente reconectar.",
    );
    expect(feedbackContracts.chatConnectionMessage("connected")).toBe("Chat conectado.");
  });

  it.each([
    [null, "Não foi possível enviar a mensagem."],
    [{ ok: false, reason: "rate_limited" }, "Calma! Você está enviando mensagens rápido demais."],
    [{ ok: false, reason: "invalid_length" }, "A mensagem precisa ter entre 1 e 500 caracteres."],
    [
      { ok: false, reason: "blocked", message: "Mensagem bloqueada pela moderação." },
      "Mensagem bloqueada pela moderação.",
    ],
    [
      { ok: false, reason: "muted", message: "Você está silenciado no chat." },
      "Você está silenciado no chat.",
    ],
    [{ ok: false, reason: "error" }, "Não foi possível enviar a mensagem."],
  ] as const)("maps send result %j to safe feedback", (result, expected) => {
    expect(feedbackContracts.chatSendFailureMessage(result)).toBe(expected);
  });
});
