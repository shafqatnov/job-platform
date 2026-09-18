/**
 * Parses the `digest` Next.js's own redirect()/notFound() attach to the
 * error they throw, in the exact format Next's internal
 * isRedirectError()/getURLFromRedirectError() use (verified against
 * node_modules/next/dist/client/components/redirect-error.js):
 * "NEXT_REDIRECT;<type>;<destination>;<statusCode>;". Not exported from
 * the public "next/navigation" entry point, so this project re-derives
 * the same parsing rather than depending on Next's internal module path.
 */
export function getRedirectDestination(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return null;
  }
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT;")) {
    return null;
  }
  const parts = digest.split(";");
  return parts.slice(2, -2).join(";");
}
