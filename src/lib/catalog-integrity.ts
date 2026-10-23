/** Reject broken labels at ingestion, without inventing a club name or changing its identity. */
export function validCatalogLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 1000 &&
    !["null", "undefined", "[object object]"].includes(value.trim().toLowerCase())
  );
}

export function validCatalogIdentity(value: unknown): value is string {
  return validCatalogLabel(value) && value === value.trim();
}
