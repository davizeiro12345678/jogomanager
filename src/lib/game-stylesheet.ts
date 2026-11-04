import appCss from "../styles.css?url";

/** The single URL of the full game stylesheet. The root head and the quick
 * match both use this `?url` asset; a second plain `import "@/styles.css"`
 * made the server build name the file differently from the browser build,
 * so every game page linked a missing stylesheet and painted unstyled. */
export const GAME_STYLESHEET_URL = appCss;
