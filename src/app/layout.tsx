import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

/**
 * Next.js's own official App Router integration
 * (https://nextjs.org/docs/app/guides/third-party-libraries#google-analytics)
 * — it listens to App Router navigation itself, so client-side route
 * changes are tracked as page views automatically; no manual
 * usePathname/useEffect wiring is needed or added here.
 *
 * Gated to production only: NODE_ENV is "development" under `next dev`
 * and "production" under both `next build`/`next start` and the actual
 * Vercel deployment, so this same check keeps every local dev session
 * (and this project's test suite) free of any analytics network calls.
 */
const GA_MEASUREMENT_ID = "G-RQQT7CCNM3";
const isProduction = process.env.NODE_ENV === "production";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Jobnura",
    template: "%s | Jobnura",
  },
  description: "A global job search platform connecting candidates and employers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
      {isProduction ? <GoogleAnalytics gaId={GA_MEASUREMENT_ID} /> : null}
    </html>
  );
}
