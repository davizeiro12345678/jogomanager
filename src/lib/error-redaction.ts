/** Shared, bounded redaction for diagnostic text; never changes the original error. */
export function redactDiagnosticText(text: string, maximumLength = 320): string {
  return text
    .slice(0, maximumLength)
    .replace(
      /\b((?:[\w-]*(?:token|secret|password|api[_-]?key)|key)["']?\s*[=:]\s*")((?:\\[\s\S]|[^"\\])*)(?:"|\\?$)/gi,
      '$1[redacted]"',
    )
    .replace(
      /\b((?:[\w-]*(?:token|secret|password|api[_-]?key)|key)["']?\s*[=:]\s*')((?:\\[\s\S]|[^'\\])*)(?:'|\\?$)/gi,
      "$1[redacted]'",
    )
    .replace(
      /\b((?:proxy-)?authorization["']?\s*[=:]\s*["']?(?:(?:bearer|basic)\s+)?)[^\s,"'&<>]+/gi,
      "$1[redacted]",
    )
    .replace(/\b(bearer\s+)[^\s,"'<>]+/gi, "$1[redacted]")
    .replace(
      /\b((?:[\w-]*(?:token|secret|password|api[_-]?key)|key)["']?\s*[=:]\s*["']?)[^\s,"'&<>]+/gi,
      "$1[redacted]",
    )
    .replace(/\b((?:token|key) +)[^\s,"'&<>]+/gi, "$1[redacted]")
    .slice(0, maximumLength);
}
