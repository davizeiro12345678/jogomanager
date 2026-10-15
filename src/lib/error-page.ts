/** Self-contained recovery page with no reflected error details. */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Não foi possível carregar · JogoManager</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <style>
      * { box-sizing: border-box; }
      body { font: 16px/1.6 system-ui, -apple-system, sans-serif; background: #0c151f; color: #edf3f8; display: grid; place-items: center; min-height: 100dvh; margin: 0; padding: 1.5rem; }
      main { max-width: 34rem; width: 100%; padding: 2rem; background: #14212e; border: 1px solid #2c3e50; border-radius: 18px; }
      h1 { font-size: clamp(1.4rem, 5vw, 1.9rem); line-height: 1.2; margin: 0 0 1rem; letter-spacing: -.025em; }
      p { color: #a5b6c7; margin: 0 0 1.75rem; }
      .actions { display: flex; gap: .75rem; flex-wrap: wrap; }
      a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: .65rem 1rem; border-radius: 10px; font: inherit; font-weight: 600; text-decoration: none; border: 1px solid #3b5066; color: #edf3f8; }
      a:first-child { background: #b8ed70; color: #122007; border-color: transparent; }
      a:focus-visible { outline: 3px solid #a5e8ff; outline-offset: 4px; }
      a:hover { filter: brightness(1.1); }
      @media (max-width: 400px) { main { padding: 1.5rem; } .actions a { width: 100%; } }
    </style>
  </head>
  <body>
    <main>
      <h1>Não foi possível carregar esta página</h1>
      <p>O jogo encontrou um problema ao abrir esta tela. Tente carregar a página novamente ou volte ao início para continuar.</p>
      <div class="actions">
        <a href="">Tentar novamente</a>
        <a href="/">Voltar ao início</a>
      </div>
    </main>
  </body>
</html>`;
}
