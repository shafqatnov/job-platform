/**
 * Deterministic, URL-safe slug generation from arbitrary text. Pure
 * function, no I/O — collision resolution (making a slug unique within
 * whatever scope applies) is the caller's responsibility.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
