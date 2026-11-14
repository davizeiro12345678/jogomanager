const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { onExecutePostLogin } = require("./post-login-supabase-role.cjs");

function testContext(secretClientId, appClientId) {
  const calls = [];
  return {
    event: {
      secrets: secretClientId ? { PFM3D_AUTH0_CLIENT_ID: secretClientId } : {},
      client: { client_id: appClientId },
    },
    api: { idToken: { setCustomClaim: (key, value) => calls.push([key, value]) } },
    calls,
  };
}

describe("Auth0 Supabase role Action", () => {
  it("adds the exact role claim only for the dedicated game client", async () => {
    const context = testContext("pfm3d-client", "pfm3d-client");
    await onExecutePostLogin(context.event, context.api);
    assert.deepEqual(context.calls, [["role", "authenticated"]]);
  });

  it("does not grant a role to another application in the same tenant", async () => {
    const context = testContext("pfm3d-client", "other-client");
    await onExecutePostLogin(context.event, context.api);
    assert.deepEqual(context.calls, []);
  });

  it("fails closed when the Action secret is absent", async () => {
    const context = testContext(undefined, "pfm3d-client");
    await onExecutePostLogin(context.event, context.api);
    assert.deepEqual(context.calls, []);
  });
});
