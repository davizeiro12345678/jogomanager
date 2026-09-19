// O pacote não publica tipos; só usamos configureTextBuilder diretamente.
declare module "troika-three-text" {
  export function configureTextBuilder(options: { useWorker?: boolean }): void;
}
