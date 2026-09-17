export type ClassValue = string | number | null | boolean | undefined;

/**
 * Joins truthy class name values with a single space. Deliberately
 * minimal (no conflict resolution) since this project does not combine
 * conflicting Tailwind utilities that would need deduping.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string | number => Boolean(value)).join(" ");
}
