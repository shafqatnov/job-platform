import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getButtonClassName } from "@/components/Button";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "About";
const DESCRIPTION =
  "Learn how our global job platform connects candidates and employers across multiple countries, and the trust and moderation principles behind every listing.";
const siteUrl = getConfiguredSiteUrl();
const path = "/about";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
  openGraph: {
    title: `${TITLE} | Jobnura`,
    description: DESCRIPTION,
    type: "website",
    ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
  },
  twitter: {
    card: "summary",
    title: `${TITLE} | Jobnura`,
    description: DESCRIPTION,
  },
};

export default function AboutPage() {
  return (
    <>
      <Section aria-labelledby="about-heading" className="pb-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-center">
          <h1 id="about-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Connecting candidates and employers, wherever they are
          </h1>
          <p className="text-lg text-muted-foreground">
            We built this platform on a simple idea: finding a real job — and finding the right
            person to fill one — shouldn&apos;t depend on which country you happen to be searching
            from. Every listing is attributed to the real company behind it — whether posted
            directly by that employer or brought in from an authorized job source — and passes
            through review before it reaches a candidate.
          </p>
        </div>
      </Section>

      <Section className="bg-surface-muted" aria-labelledby="mission-heading">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 id="mission-heading" className="text-xl font-semibold text-foreground">
              Our mission
            </h2>
            <p className="text-muted-foreground">
              Make it straightforward for employers to reach genuine candidates across borders,
              and for candidates to find real, verified opportunities — without the noise of
              recycled listings or unverified sources.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-semibold text-foreground">Our vision</h2>
            <p className="text-muted-foreground">
              A single, trustworthy place to search for work across multiple countries and
              industries, where every listing is attributable to a real company and every
              candidate profile represents a real person — no aggregated noise, no recycled
              content.
            </p>
          </div>
        </div>
      </Section>

      <Section aria-labelledby="how-it-works-heading">
        <h2 id="how-it-works-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          How the platform works
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Card padding="lg" className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">For employers</h3>
            <p className="text-muted-foreground">
              An employer creates a company profile, then submits a job listing with the role
              details, location, and how candidates should apply — either directly on the
              platform or through their own application link. Every submission is reviewed before
              it becomes publicly visible.
            </p>
          </Card>
          <Card padding="lg" className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">For candidates</h3>
            <p className="text-muted-foreground">
              A candidate creates a basic profile, then searches and filters listings by country,
              category, and keyword. Applying to an on-platform listing takes one action; an
              employer using their own application system is linked out directly and clearly.
            </p>
          </Card>
        </div>
      </Section>

      <Section className="bg-surface-muted" aria-labelledby="global-heading">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 text-center">
          <h2 id="global-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Built for hiring across borders
          </h2>
          <p className="text-muted-foreground">
            Job listings and search are organized by country from the ground up, so an employer
            hiring in one market and a candidate searching in another both get a page built
            around their market — not a single undifferentiated global feed. As we grow, more
            countries and categories are added to the same structure, not bolted on separately.
          </p>
        </div>
      </Section>

      <Section aria-labelledby="trust-heading">
        <h2 id="trust-heading" className="mb-8 text-2xl font-semibold text-foreground sm:text-3xl">
          Trust and moderation
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <Card padding="lg" className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">Real listings, clearly sourced</h3>
            <p className="text-muted-foreground">
              Most listings are submitted directly by the employer offering the role. Jobnura also
              includes listings brought in from authorized external sources, such as Adzuna — these
              are clearly attributed to where they came from, and we never fabricate or invent a
              listing ourselves.
            </p>
          </Card>
          <Card padding="lg" className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">Reviewed before publishing</h3>
            <p className="text-muted-foreground">
              Every listing — however it reaches Jobnura — passes through automated checks for
              duplicates, missing information, and content that doesn&apos;t belong on a job board
              before it can appear publicly. A listing that doesn&apos;t clearly pass every check is
              held for a person on our team to review before it goes live.
            </p>
          </Card>
          <Card padding="lg" className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">AI-assisted review</h3>
            <p className="text-muted-foreground">
              AI-assisted checks are part of how we review listings — helping assess quality,
              duplicates, and whether the job details make sense. A listing that clearly passes
              every automated and AI check may be published without an additional manual step;
              anything less certain is queued for a person on our team to decide.
            </p>
          </Card>
          <Card padding="lg" className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">Accountable, not anonymous</h3>
            <p className="text-muted-foreground">
              Employers, candidates, and administrators each operate within clearly separated
              areas of the platform, and moderation decisions are logged — so trust on this
              platform isn&apos;t just a promise, it&apos;s something we can account for.
            </p>
          </Card>
        </div>
      </Section>

      <Section className="bg-surface-muted" aria-labelledby="cta-heading">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h2 id="cta-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Ready to get started?
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/jobs" className={getButtonClassName({ size: "lg" })}>
              Browse jobs
            </Link>
            <Link href="/employer" className={getButtonClassName({ size: "lg", variant: "outline" })}>
              Post a job
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
