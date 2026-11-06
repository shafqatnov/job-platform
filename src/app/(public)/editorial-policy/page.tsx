import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { PolicySection } from "@/features/legal/PolicySection";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Editorial Policy";
const DESCRIPTION = "How Jobnura researches, writes, and reviews articles published on the Jobnura blog.";
const LAST_UPDATED = "5 November 2026";
const siteUrl = getConfiguredSiteUrl();
const path = "/editorial-policy";

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

export default function EditorialPolicyPage() {
  return (
    <Section aria-labelledby="editorial-policy-heading">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-2">
          <h1 id="editorial-policy-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Editorial Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <Card padding="lg" className="mb-10">
          <p className="text-sm text-muted-foreground">
            This policy describes how articles on the Jobnura blog are written and reviewed. It
            applies to every article published under /blog, regardless of topic.
          </p>
        </Card>

        <div className="flex flex-col gap-8">
          <PolicySection title="1. Original content only">
            <p>
              Jobnura blog articles are written for Jobnura. We do not copy, closely paraphrase, or
              republish articles or job descriptions from other websites.
            </p>
          </PolicySection>

          <PolicySection title="2. No invented facts">
            <p>
              We do not invent statistics, salary figures, certification requirements, or other
              factual claims. Where a claim requires a specific, verifiable detail — such as a
              certification&apos;s validity period or an official training requirement — we either cite
              a real, named, current source or leave the detail out until it can be verified.
            </p>
          </PolicySection>

          <PolicySection title="3. Draft articles are clearly labelled">
            <p>
              An article that has not yet completed our review process is marked as a draft on the
              page itself, is not linked from the blog homepage or category pages, and is not
              submitted for search engine indexing.
            </p>
          </PolicySection>

          <PolicySection title="4. Relationship to job listings">
            <p>
              Blog articles may link to relevant job categories or listings on Jobnura. An article
              is never written to misrepresent a job listing&apos;s requirements, pay, or location —
              see our job listings themselves for that information.
            </p>
          </PolicySection>

          <PolicySection title="5. Sponsored or partnered content">
            <p>
              Any article involving a training-provider partnership, sponsorship, or affiliate
              relationship is clearly labelled as such, in line with our{" "}
              <Link href="/advertising-disclosure" className="text-brand-600 underline">
                Advertising Disclosure
              </Link>
              .
            </p>
          </PolicySection>

          <PolicySection title="6. Corrections">
            <p>
              If you believe an article contains an error, contact us using the details on our{" "}
              <Link href="/contact" className="text-brand-600 underline">
                Contact
              </Link>{" "}
              page and we will review and correct it where warranted.
            </p>
          </PolicySection>
        </div>
      </div>
    </Section>
  );
}
