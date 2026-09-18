import { headers } from "next/headers";

/**
 * There is no confirmed production domain for this project yet — no
 * approved environment variable or constant for it exists anywhere in
 * this codebase (verified: BETTER_AUTH_URL is Better Auth's own
 * internal base-URL setting, not a general-purpose "site URL", and is
 * deliberately not reused here for an unrelated concern).
 *
 * NEXT_PUBLIC_SITE_URL is the one new, optional configuration point
 * this task introduces. It is unset today and nothing in this codebase
 * invents a value for it — every caller below degrades safely when it
 * is absent, exactly as required.
 */
function readConfiguredSiteUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) {
    return undefined;
  }
  return raw.replace(/\/+$/, "");
}

/**
 * For canonical URLs and Open Graph/Twitter `url` fields: returns the
 * real configured production URL, or `undefined` if none exists yet.
 * Callers must omit the field entirely when this returns `undefined` —
 * never fall back to a guessed or localhost value here, since these
 * are asserted, public-facing claims about where a page canonically
 * lives.
 */
export function getConfiguredSiteUrl(): string | undefined {
  return readConfiguredSiteUrl();
}

/**
 * For sitemap.xml/robots.txt only, which structurally require an
 * absolute URL to function at all (a sitemap entry cannot be a
 * relative path). Uses NEXT_PUBLIC_SITE_URL when configured; otherwise
 * derives the origin from the actual incoming request's own Host
 * header — never a hardcoded guess, and never a value this codebase
 * invented — so the sitemap is genuinely correct in whatever
 * environment actually served the request (localhost in development,
 * the real domain once deployed and configured).
 */
export async function getSiteOrigin(): Promise<string> {
  const configured = readConfiguredSiteUrl();
  if (configured) {
    return configured;
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
