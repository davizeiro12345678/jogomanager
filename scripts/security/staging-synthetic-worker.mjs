/**
 * Isolated security-scan staging harness — NOT the live Pro Football Manager 3D app.
 *
 * No env bindings, no database, no payment provider, no outbound fetch(),
 * no Durable Objects and no production origin routing. All writes are mock.
 */
const ORIGIN = "https://staging.jogomanager.com";
const htmlHeaders = {
  "Content-Type": "text/html; charset=UTF-8",
  "Cache-Control": "no-store, private",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-PFM-Isolated-Stage": "yes",
  "X-PFM-Synthetic": "true",
};
const jsonHeaders = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-PFM-Isolated-Stage": "yes",
  "X-PFM-Synthetic": "true",
};
const mock = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extra } });
const page = (title, content, status = 200) =>
  new Response(
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>' +
      title +
      ' — PFM Staging</title></head><body><header><strong>SIMULAÇÃO ISOLADA — NÃO É O JOGO DE PRODUÇÃO</strong></header><nav><a href="/">Início</a> | <a href="/auth">Login</a> | <a href="/dashboard">Painel</a> | <a href="/saves">Saves</a> | <a href="/checkout">Checkout</a> | <a href="/multiplayer">Multiplayer</a></nav><main><h1>' +
      title +
      "</h1>" +
      content +
      "</main></body></html>",
    { status, headers: htmlHeaders },
  );
const isSignedIn = (req) =>
  /(?:^|;\s*)pfm_stage_session=synthetic-only(?:;|$)/.test(req.headers.get("Cookie") || "");

export default {
  async fetch(request, env) {
    // Refuse any deployment accidentally reusing privileged Worker bindings.
    if (env && Object.keys(env).length > 0)
      return mock({ error: "unexpected_staging_binding", isolated: false }, 503);
    const url = new URL(request.url);
    if (url.hostname !== "staging.jogomanager.com")
      return mock({ error: "staging_hostname_required" }, 421);
    const method = request.method;
    const path = url.pathname;
    if (path === "/__security/health" && method === "GET")
      return mock({
        service: "pfm-security-staging",
        isolated: true,
        mock: true,
        production_access: false,
        supabase: "not-connected",
        stripe: "not-connected",
        multiplayer: "not-connected",
      });
    if (path === "/" && method === "GET")
      return page(
        "Ambiente de teste",
        "<p>Este Worker é apenas um ambiente de testes sintéticos para configurar ZAP, DNS e TLS. O jogo completo ainda não foi implantado aqui.</p>",
      );
    if (path === "/auth" && method === "GET")
      return page(
        "Autenticação sintética",
        '<form method="post" action="/api/auth/login"><label>Usuário <input name="username"></label><label>Senha <input name="password" type="password"></label><button type="submit">Entrar</button></form>',
      );
    if (path === "/api/auth/login" && method === "POST") {
      const f = await request.formData().catch(() => null);
      if (
        !f ||
        f.get("username") !== "zap-synthetic" ||
        f.get("password") !== "synthetic-not-a-secret"
      )
        return mock({ error: "synthetic_invalid_credentials" }, 401);
      return new Response(null, {
        status: 303,
        headers: {
          ...jsonHeaders,
          Location: "/dashboard",
          "Set-Cookie":
            "pfm_stage_session=synthetic-only; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600",
        },
      });
    }
    if (path === "/api/auth/logout" && method === "POST")
      return mock({ logout: true, mock: true }, 200, {
        "Set-Cookie": "pfm_stage_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
      });
    if (path === "/dashboard" && method === "GET")
      return isSignedIn(request)
        ? page(
            "Painel fictício",
            "<p>Conta de teste autenticada. Dados exclusivamente sintéticos.</p>",
          )
        : mock({ error: "not_authenticated" }, 401);
    if (path === "/checkout" && method === "GET")
      return page(
        "Checkout fictício",
        '<form action="/api/checkout" method="post"><button type="submit">Simular compra sem dinheiro</button></form>',
      );
    if (path === "/api/checkout" && method === "POST")
      return isSignedIn(request)
        ? mock(
            { mock: true, charge_created: false, stripe_called: false, order_id: "synthetic" },
            200,
          )
        : mock({ error: "not_authenticated" }, 401);
    if (path === "/multiplayer" && method === "GET")
      return page(
        "Multiplayer fictício",
        '<p>Nenhuma partida real é iniciada.</p><form action="/api/multiplayer/match" method="post"><button type="submit">Simular partida</button></form>',
      );
    if (path === "/saves" && method === "GET")
      return page(
        "Saves fictícios",
        '<p>Nenhum save real é gravado.</p><form action="/api/saves" method="post"><button type="submit">Simular salvamento</button></form>',
      );
    if (path === "/api/multiplayer/match" && method === "POST")
      return isSignedIn(request)
        ? mock({ mock: true, room: "synthetic-room", persisted: false }, 202)
        : mock({ error: "not_authenticated" }, 401);
    if (path === "/api/saves" && method === "GET")
      return isSignedIn(request)
        ? mock({ mock: true, saves: [{ id: "dummy", owner: "synthetic" }] })
        : mock({ error: "not_authenticated" }, 401);
    if (path === "/api/saves" && (method === "POST" || method === "PUT" || method === "DELETE"))
      return isSignedIn(request)
        ? mock({ mock: true, persisted: false, production_touched: false }, 200)
        : mock({ error: "not_authenticated" }, 401);
    return mock({ error: "not_found", mock: true }, 404);
  },
};
