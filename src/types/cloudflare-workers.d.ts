/**
 * Runtime binding types for the Cloudflare Workers native module.
 *
 * The module is only available within the Workers runtime; callers catch
 * its absence in Node previews. This ambient declaration keeps the strict
 * TypeScript build aligned with that runtime boundary without exposing
 * secret values or assuming process.env contains Worker bindings.
 */
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
