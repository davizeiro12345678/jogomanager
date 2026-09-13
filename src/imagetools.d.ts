/** Tipos para as variações de imagem geradas no build (avif/webp/srcset). */
declare module "*&as=srcset" {
  const srcset: string;
  export default srcset;
}

declare module "*&as=url" {
  const url: string;
  export default url;
}
