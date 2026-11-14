/**
 * Auth0 Dashboard > Actions > Post Login.
 *
 * Configure one Action Secret named PFM3D_AUTH0_CLIENT_ID with the dedicated
 * Auth0 SPA application's client ID, then deploy and attach to Post Login.
 *
 * Do not attach an unscoped action to other tenants or applications.
 * Supabase third-party auth expects the LITERAL "role" claim in an ID token.
 */
exports.onExecutePostLogin = async (event, api) => {
  const allowedClientId = event.secrets?.PFM3D_AUTH0_CLIENT_ID;
  if (!allowedClientId || event.client?.client_id !== allowedClientId) {
    return;
  }

  api.idToken.setCustomClaim("role", "authenticated");
};
