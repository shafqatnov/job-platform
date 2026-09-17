import Link from "next/link";
import { Section } from "@/components/Section";
import { getButtonClassName } from "@/components/Button";

/**
 * Shared 404 for the public shell (keeps Header/Footer instead of
 * Next.js's bare default not-found page). Reached e.g. when a country
 * code in the URL isn't in the supported country reference data.
 */
export default function PublicNotFound() {
  return (
    <Section aria-labelledby="not-found-heading">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <h1 id="not-found-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Page not found
        </h1>
        <p className="text-muted-foreground">
          We couldn&apos;t find the page you were looking for. It may have moved, or the country
          you requested isn&apos;t supported yet.
        </p>
        <Link href="/" className={getButtonClassName({ size: "lg" })}>
          Back to homepage
        </Link>
      </div>
    </Section>
  );
}
