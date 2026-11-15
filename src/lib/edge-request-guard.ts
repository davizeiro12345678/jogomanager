/**
 * A small defense-in-depth policy for the public Worker entrypoint.
 *
 * Cloudflare WAF does not re-evaluate same-zone Worker subrequests. This
 * guard runs before SSR and protects every hostname attached to this Worker.
 * It does not replace Cloudflare WAF, authentication or application RBAC.
 */
const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);

const SECRET_SEGMENT =
  /(?:^|\/)(?:\.env(?:\.[^/]*)?|\.git|\.svn|\.hg|\.ssh|\.aws|\.kube|\.terraform|\.wrangler|node_modules)(?:\/|$)/;
const SECRET_FILE =
  /(?:^|\/)(?:\.npmrc|\.pypirc|\.netrc|\.pgpass|\.git-credentials|\.bash_history|\.zsh_history|\.my\.cnf|\.htpasswd|\.htaccess|id_rsa|id_ed25519|private\.key|server\.key|terraform\.tfstate(?:\.backup)?|credentials\.json|secrets\.json|service-account\.json|firebase-adminsdk\.json|backup\.sql(?:\.gz)?|dump\.sql(?:\.gz)?|database\.sql|docker-compose(?:\.override)?\.yml)(?:\/|$)/;

const PROBE_PREFIXES = [
  "/actuator/",
  "/debug/pprof",
  "/_ignition/",
  "/_debugbar/",
  "/telescope/",
  "/wp-admin/",
  "/wp-content/plugins/",
  "/wp-content/themes/",
  "/wp-includes/",
  "/wp-json/",
  "/cgi-bin/",
  "/phpmyadmin",
  "/pma/",
  "/vendor/phpunit/",
  "/jenkins/script",
  "/solr/admin/",
  "/jmx-console/",
  "/administrator/components/",
  "/boaform/",
  "/geoserver/web",
] as const;

const PROBE_PATHS = new Set([
  "/actuator",
  "/server-status",
  "/server-info",
  "/wp-login.php",
  "/wp-config.php",
  "/wp-cron.php",
  "/wp-json",
  "/xmlrpc.php",
  "/phpinfo.php",
  "/info.php",
  "/adminer.php",
  "/adminer",
  "/phpmyadmin",
  "/pma",
  "/setup.php",
  "/v2/_catalog",
  "/debug/vars",
  "/etc/passwd",
  "/etc/shadow",
]);

function normalizedPath(rawPath: string): string {
  // Decode a bounded number of times to catch common double-encoding of
  // sensitive files. Never touch the query string (OAuth uses it legitimately).
  let path = rawPath;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const next = decodeURIComponent(path);
      if (next === path) break;
      path = next;
    } catch {
      break;
    }
  }
  return path.replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
}

/** Returns a response only for high-confidence abuse, otherwise null. */
export function rejectSuspiciousEdgeRequest(request: Request): Response | null {
  const path = normalizedPath(new URL(request.url).pathname);
  if (
    HTTP_METHODS.has(request.method.toUpperCase()) &&
    !SECRET_SEGMENT.test(path) &&
    !SECRET_FILE.test(path) &&
    !PROBE_PATHS.has(path) &&
    !PROBE_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return null;
  }

  return new Response(request.method === "HEAD" ? null : "Forbidden", {
    status: 403,
    headers: {
      "cache-control": "private, no-store",
      "content-type": "text/plain; charset=utf-8",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
