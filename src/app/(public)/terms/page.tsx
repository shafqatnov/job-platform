import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { PolicySection } from "@/features/legal/PolicySection";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Terms of Service";
const DESCRIPTION = "The terms governing use of Jobnura by candidates, employers, and administrators.";
const LAST_UPDATED = "22 September 2026";
const siteUrl = getConfiguredSiteUrl();
const path = "/terms";

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

export default function TermsPage() {
  return (
    <Section aria-labelledby="terms-heading">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-2">
          <h1 id="terms-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <Card padding="lg" className="mb-10">
          <p className="text-sm text-muted-foreground">
            These terms describe, in general language, the rules for using the platform. They are
            written to reflect how the platform actually operates today and should be reviewed by
            qualified legal counsel for your specific jurisdiction before public launch.
          </p>
        </Card>

        <div className="flex flex-col gap-8">
          <PolicySection title="1. Platform usage">
            <p>
              By creating an account, you agree to use the platform only for its intended
              purpose: genuine job seeking and genuine hiring. You are responsible for keeping
              your account credentials secure and for all activity under your account.
            </p>
          </PolicySection>

          <PolicySection title="2. Employer responsibilities">
            <ul>
              <li>Job listings must describe a real, currently available position at a real company.</li>
              <li>You must have the authority to post on behalf of the company you represent.</li>
              <li>Listing details (title, description, location, category, and how to apply) must be accurate.</li>
              <li>
                If candidates apply through your own external system rather than on Jobnura, that
                link must lead directly to a real, working application process for the listed role.
              </li>
              <li>You are responsible for reviewing and responding to applications you receive.</li>
            </ul>
          </PolicySection>

          <PolicySection title="3. Candidate responsibilities">
            <ul>
              <li>Profile information must be accurate and represent you, not a fictitious or third-party identity.</li>
              <li>Applications must be genuine expressions of interest in the role applied to.</li>
              <li>You are responsible for the accuracy of anything you submit as part of an application.</li>
            </ul>
          </PolicySection>

          <PolicySection title="4. Content ownership">
            <p>
              Employers retain ownership of the job listing content they submit. Candidates retain
              ownership of their profile information. By submitting content to the platform, you
              grant us the right to display, store, and process it as necessary to operate the
              platform — for example, showing a job listing to candidates, or an application to
              the employer who received it. Some listings on Jobnura are instead brought in from
              an authorized external job source rather than submitted directly by an employer; each
              such listing is clearly attributed to the company and source it came from.
            </p>
          </PolicySection>

          <PolicySection title="5. Prohibited content">
            <p>You may not submit content that:</p>
            <ul>
              <li>Is fraudulent, misleading, or does not describe a genuine opportunity.</li>
              <li>Solicits payment from candidates, or promotes pyramid or multi-level-marketing schemes.</li>
              <li>Infringes another party&apos;s intellectual property or was copied from a source you are not authorized to redistribute.</li>
              <li>Is unlawful, discriminatory, or otherwise violates applicable employment law.</li>
              <li>Is spam, a duplicate of an existing listing, or otherwise not a good-faith, original submission.</li>
            </ul>
          </PolicySection>

          <PolicySection title="6. Moderation">
            <p>
              Every job listing — whether submitted directly by an employer or brought in from an
              authorized external source — passes through automated checks (for duplicates,
              missing information, and content that doesn&apos;t belong on a job board) before it
              can become publicly visible. A listing that doesn&apos;t clearly pass every check is
              held for a person on our team to review; we may reject, request changes to, or remove
              a listing that does not meet these terms, at our reasonable discretion, and we keep a
              record of moderation decisions for accountability purposes.
            </p>
          </PolicySection>

          <PolicySection title="7. AI-assisted moderation">
            <p>
              AI-assisted checks are part of how listings are reviewed — assessing things like
              content quality, potential duplicates, and whether a listing&apos;s category and
              location can be confidently identified. A listing that clearly passes every automated
              and AI check may be published without an additional manual review step; anything less
              certain is queued for a person on our team to decide. Final publishing decisions
              remain accountable to our moderation process, not to an automated system acting alone
              on a listing it flagged as uncertain.
            </p>
          </PolicySection>

          <PolicySection title="8. Account suspension">
            <p>
              We may suspend or terminate an account that violates these terms, submits prohibited
              content repeatedly, or is used in a way that harms other users or the platform.
              Where practical, we will explain the reason for a suspension.
            </p>
          </PolicySection>

          <PolicySection title="9. Future premium services">
            <p>
              The platform is currently free to use for both candidates and employers. We may
              introduce optional paid services in the future (for example, enhanced visibility for
              a listing). Any such services will be clearly described and optional — core job
              search and job posting are not intended to require payment.
            </p>
          </PolicySection>

          <PolicySection title="10. Liability">
            <p>
              The platform connects candidates and employers but is not a party to any employment
              relationship, offer, or agreement between them. We do not guarantee the accuracy of
              listings beyond our moderation process, the outcome of any application, or the
              conduct of any user. To the fullest extent permitted by law, the platform is
              provided &quot;as is,&quot; and we are not liable for indirect or consequential
              losses arising from its use.
            </p>
          </PolicySection>
        </div>
      </div>
    </Section>
  );
}
