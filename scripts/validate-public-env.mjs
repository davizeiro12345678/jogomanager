import { loadPublicSettings } from "./public-settings.mjs";

for (const mode of ["development", "production"]) loadPublicSettings(mode);
console.log("Public configuration formats and consistency: PASS (no values printed)");
