// Compatibility facade for the complete synchronous translation API.
// UI imports the provider directly to keep optional language packs deferred.
export * from "./provider";
export { translate } from "./messages";
