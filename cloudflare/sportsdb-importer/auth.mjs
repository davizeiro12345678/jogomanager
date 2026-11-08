const BEARER_PATTERN = /^Bearer[\t ]+(.+)$/i;

function constantTimeEqual(left, right) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index++) {
    difference |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return difference === 0;
}

/**
 * Read the importer credential from request headers only.
 * Query parameters are deliberately ignored so URLs cannot carry the secret.
 */
export function readImporterToken(request) {
  const authorization = request.headers.get("Authorization")?.trim();
  if (authorization) {
    const bearer = BEARER_PATTERN.exec(authorization);
    return bearer?.[1]?.trim() || null;
  }

  return request.headers.get("X-Import-Secret")?.trim() || null;
}

export function isImporterAuthorized(request, env) {
  const expected = String(env?.THESPORTSDB_IMPORT_SECRET || "").trim();
  const presented = readImporterToken(request);
  return Boolean(expected && presented && constantTimeEqual(presented, expected));
}
