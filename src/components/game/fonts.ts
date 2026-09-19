/**
 * Fonte de exibição usada pelo texto 3D (troika): placar do estádio e
 * nomes/números nas costas dos jogadores. Fica em `public/fonts` para ser
 * servida localmente — nada de buscar fonte em CDN (funciona offline e é
 * cacheada pelo service worker).
 */
export const DISPLAY_FONT = "/fonts/BarlowCondensed-Bold.ttf";

/**
 * O troika tenta montar um web worker por blob para gerar o atlas do texto.
 * Em vários navegadores (e em qualquer contexto com CSP mais fechada) essa
 * criação falha repetidas vezes durante a partida, e cada tentativa custa um
 * engasgo no quadro. Como o nosso texto 3D é pouco e curto (placar e nome nas
 * costas), sai mais barato gerar na própria thread e nunca pagar a falha.
 */
export function configureText3D() {
  if (typeof window === "undefined") return;
  void import("troika-three-text").then((m) => {
    m.configureTextBuilder?.({ useWorker: false });
  });
}
