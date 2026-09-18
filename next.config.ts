import type { NextConfig } from "next";

/**
 * Baseline production security headers. Deliberately does NOT include:
 *
 *  - Content-Security-Policy: a real CSP needs to know every external
 *    script/style/font origin this app will ever load (future AdSense,
 *    an analytics provider, Google Fonts, etc.), none of which are
 *    configured yet — see docs/25-launch-checklist.md. Shipping a CSP
 *    now would mean guessing those origins, which risks silently
 *    breaking Next.js's own inline hydration data and Better Auth's
 *    client, or shipping a CSP so loose it adds no real protection.
 *    Add this once the real external script list is known.
 *  - Strict-Transport-Security (HSTS): this project has no confirmed
 *    production hosting/HTTPS termination yet (docs/14). HSTS is only
 *    safe to ship once HTTPS is guaranteed at the edge — sending it
 *    prematurely (or from behind a misconfigured proxy) can lock out
 *    a domain from ever serving plain HTTP again, including in
 *    development-adjacent environments. Add this once real production
 *    hosting with guaranteed HTTPS is confirmed.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Equivalent to frame-ancestors 'none' — this app is never meant to be
  // embedded in another site's frame/iframe.
  { key: "X-Frame-Options", value: "DENY" },
  // Denies browser features this app has no use for; does not restrict
  // anything the app actually uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Isolates this app's browsing context from cross-origin windows it
  // opens/is opened by. Safe now: Better Auth's email/password flow
  // never opens a cross-origin popup (no OAuth is configured), and
  // external application links already carry rel="noopener" separately.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Prevents other origins from embedding this app's own responses
  // (images, scripts, etc.) into their pages. Safe now: nothing in this
  // app is designed to be embedded cross-origin, and no CDN/asset host
  // on a different origin is in use.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
