import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ consent: false, telemetry: vi.fn(), lovable: vi.fn() }));
vi.mock("./consent", () => ({ readConsent: () => ({ telemetry: state.consent }) }));
vi.mock("./lovable-error-reporting", () => ({ reportLovableError: state.lovable }));
vi.mock("./telemetry-client", () => ({ reportTechSample: state.telemetry }));
import { installBrowserErrorReporting } from "./runtime-error-reporting";
import { reportSilent } from "./report-silent";

afterEach(() => {
  vi.unstubAllGlobals();
  state.consent = false;
  vi.clearAllMocks();
});
function install() {
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  return installBrowserErrorReporting();
}
describe("consented lazy runtime reporting", () => {
  it("keeps the local error sink working without sending optional telemetry", async () => {
    const stop = install();
    reportSilent("test", new Error("failure"), { class: "degradation", code: "no-consent" });
    await vi.dynamicImportSettled();
    expect(state.lovable).toHaveBeenCalledOnce();
    expect(state.telemetry).not.toHaveBeenCalled();
    stop();
  });
  it("sends a redacted error code only while consent is active", async () => {
    state.consent = true;
    const stop = install();
    reportSilent("match", new Error("failure"), { class: "degradation", code: "worker-failed" });
    await vi.dynamicImportSettled();
    expect(state.telemetry).toHaveBeenCalledWith({ errorCode: "match_worker-failed" });
    stop();
  });
  it("rechecks revocation and unmount while the optional module is loading", async () => {
    state.consent = true;
    const stop = install();
    reportSilent("test", new Error("failure"), { class: "degradation", code: "revoked" });
    state.consent = false;
    await vi.dynamicImportSettled();
    expect(state.telemetry).not.toHaveBeenCalled();
    state.consent = true;
    reportSilent("test", new Error("failure"), { class: "degradation", code: "unmounted" });
    stop();
    await vi.dynamicImportSettled();
    expect(state.telemetry).not.toHaveBeenCalled();
  });
});
