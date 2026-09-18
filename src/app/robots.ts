import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/siteUrl";

/**
 * Next.js's native robots metadata route (app/robots.ts). Allows normal
 * public crawling and explicitly disallows only the private,
 * server-side-authenticated route groups — /admin, /employer,
 * /candidate (the three (dashboard) route groups' real URL paths) and
 * /api (internal endpoints, including the secured cron/moderation
 * triggers). This is a defense-in-depth crawl hint, not the security
 * boundary: every one of those routes is already protected by its own
 * server-side session/role check regardless of what robots.txt says.
 *
 * /sign-in and /sign-up are intentionally NOT disallowed here — they
 * are marked noindex on the page itself instead, so they stay
 * crawlable (any real links from them are still followed) without
 * appearing as a search result themselves.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/employer", "/candidate", "/api"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
