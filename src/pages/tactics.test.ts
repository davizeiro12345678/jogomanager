import { describe, expect, it } from "vitest";

import { tacticsSyncMessage } from "./tactics-sync";

describe("tactics save feedback", () => {
  it("prioritizes the active save operation", () => {
    expect(tacticsSyncMessage("synced", true)).toBe("Salvamento: salvando alterações…");
  });

  it("distinguishes local, cloud, pending and offline states", () => {
    expect(tacticsSyncMessage("local", false)).toBe(
      "Salvamento: alterações salvas neste aparelho.",
    );
    expect(tacticsSyncMessage("syncing", false)).toBe("Salvamento: sincronizando alterações…");
    expect(tacticsSyncMessage("synced", false)).toBe(
      "Salvamento: alterações salvas e sincronizadas na nuvem.",
    );
    expect(tacticsSyncMessage("pending", false)).toBe(
      "Salvamento: alterações salvas neste aparelho; aguardando sincronização.",
    );
    expect(tacticsSyncMessage("offline", false)).toBe(
      "Salvamento: alterações salvas neste aparelho; serão sincronizadas quando a conexão voltar.",
    );
  });
});
