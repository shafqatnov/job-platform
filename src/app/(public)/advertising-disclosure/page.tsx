import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { PolicySection } from "@/features/legal/PolicySection";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Advertising Disclosure";
const DESCRIPTION = "How advertising, sponsorships, and affiliate relationships are identified on Jobnura.";
const LAST_UPDATED = "5 November 2026";
const siteUrl = getConfiguredSiteUrl();
const path = "/advertising-disclosure";

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

export default function AdvertisingDisclosurePage() {
  return (
    <Section aria-labelledby="advertising-disclosure-heading">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-2">
          <h1 id="advertising-disclosure-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Advertising Disclosure
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <Card padding="lg" className="mb-10">
          <p className="text-sm text-muted-foreground">
            Jobnura may display advertising and may, in the future, enter sponsorship, training
            provider partnership, or affiliate relationships. This page explains how any such
            relationship is identified.
          </p>
        </Card>

        <div className="flex flex-col gap-8">
          <PolicySection title="1. Display advertising">
            <p>
              Jobnura may display third-party advertising (such as Google AdSense) on blog pages
              and elsewhere on the site. These advertisements are served by a third party and are
              visually distinguished from Jobnura&apos;s own editorial content.
            </p>
          </PolicySection>

          <PolicySection title="2. Sponsored content">
            <p>
              Any blog article written in connection with a paid sponsorship is labelled
              &quot;Sponsored&quot; at the top of the article, before the reader reaches any sponsored
              claim.
            </p>
          </PolicySection>

          <PolicySection title="3. Affiliate and training-provider links">
            <p>
              A link to an authorized training provider or other partner may, in some cases, be an
              affiliate link that could result in Jobnura receiving a referral payment. Where that
              is the case, it is disclosed next to the link itself, not only on this page.
            </p>
          </PolicySection>

          <PolicySection title="4. Editorial independence">
            <p>
              A sponsorship, affiliate, or advertising relationship does not change the factual
              content of an article. See our{" "}
              <Link href="/editorial-policy" className="text-brand-600 underline">
                Editorial Policy
              </Link>{" "}
              for how articles are researched and reviewed.
            </p>
          </PolicySection>
        </div>
      </div>
    </Section>
  );
}
