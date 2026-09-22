import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { PolicySection } from "@/features/legal/PolicySection";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Privacy Policy";
const DESCRIPTION = "How Jobnura collects, uses, and protects account, employer, and candidate data.";
const LAST_UPDATED = "22 September 2026";
const siteUrl = getConfiguredSiteUrl();
const path = "/privacy";

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

export default function PrivacyPolicyPage() {
  return (
    <Section aria-labelledby="privacy-heading">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 flex flex-col gap-2">
          <h1 id="privacy-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <Card padding="lg" className="mb-10">
          <p className="text-sm text-muted-foreground">
            This policy describes, in general terms, what data the platform collects and how it
            is used. It is written to reflect what the platform actually does today, and is
            intended as a working baseline — it should be reviewed against the specific laws of
            the country or countries in which the platform operates before public launch, rather
            than relied on as jurisdiction-specific legal advice.
          </p>
        </Card>

        <div className="flex flex-col gap-8">
          <PolicySection title="1. Account data">
            <p>
              When you create an account, we store the information you provide to sign up: your
              name, email address, a securely hashed version of your password, and your account
              type (candidate, employer, or administrator). We use this information to identify
              you, secure your account, and show you the correct area of the platform.
            </p>
          </PolicySection>

          <PolicySection title="2. Employer data">
            <p>
              Employer accounts additionally provide a company name and, optionally, other
              company details such as a website. Job listings submitted by an employer, and the
              association between an employer account and the company it represents, are stored
              so listings can be reviewed, published, and managed. Some listings are instead
              brought in from an authorized external job source rather than submitted by an
              employer account — for these, we store only the public job details and the name of
              the company the listing is attributed to; no employer account or private company
              data exists for a listing sourced this way.
            </p>
          </PolicySection>

          <PolicySection title="3. Candidate data">
            <p>
              Candidate accounts provide a basic profile: a full name, a country, and optionally a
              city. Applications submitted to a job listing are stored, associated with the
              candidate&apos;s profile and the job applied to, so employers can review who has
              applied.
            </p>
          </PolicySection>

          <PolicySection title="4. Cookies">
            <p>
              The platform uses a strictly necessary session cookie to keep you signed in; this
              cookie is required for the platform to function. In production, the platform also
              uses Google Analytics to understand aggregate site usage (see &quot;Analytics&quot;
              below), which sets its own cookies for that purpose. These analytics cookies are not
              currently presented behind a consent banner; you can limit them using your
              browser&apos;s own cookie or tracking-protection settings. Cookies are not used to
              serve advertising on this platform today.
            </p>
          </PolicySection>

          <PolicySection title="5. Authentication">
            <p>
              Sign-in is handled by a dedicated authentication system using secure, HTTP-only
              session cookies. Passwords are never stored in plain text. Your account role and
              status are determined and enforced by our servers and are never taken at face value
              from a request you or your browser send.
            </p>
          </PolicySection>

          <PolicySection title="6. Application data">
            <p>
              When a candidate applies to a job on the platform, the application record (which
              candidate applied to which job, and when) is visible to the employer who owns that
              listing. Applications are not shared with any other employer or made public.
            </p>
          </PolicySection>

          <PolicySection title="7. Analytics">
            <p>
              The platform uses Google Analytics to understand aggregate site usage — for
              example, which pages are visited and general traffic patterns. This runs only in
              the live production environment, never during development or automated testing.
              Analytics data is used in aggregate to understand how the platform is used; we do
              not use it to build individually-targeted advertising profiles. If the scope of
              analytics used on this platform changes materially, this policy will be updated.
            </p>
          </PolicySection>

          <PolicySection title="8. AI-assisted processing">
            <p>
              Jobnura uses AI-assisted checks as part of reviewing job listings — assessing
              things like content quality, potential duplicates, and whether a listing&apos;s
              category and location can be confidently identified. A listing that clearly passes
              every automated and AI check may be published without an additional manual review
              step; anything less certain is queued for a person on our team to review before it
              is published. Only the structured job-listing fields a listing already contains —
              never candidate data — are ever sent for this analysis.
            </p>
          </PolicySection>

          <PolicySection title="9. Data retention">
            <p>
              We retain account, job listing, and application data for as long as your account is
              active and as needed to operate the platform. If you would like your account or
              associated data removed, contact us using the details on our{" "}
              <Link href="/contact" className="font-medium text-brand-600 hover:text-brand-700">
                Contact page
              </Link>{" "}
              and we will address the request in line with applicable law.
            </p>
          </PolicySection>

          <PolicySection title="10. User rights">
            <p>
              Depending on where you are located, you may have rights to access, correct, or
              request deletion of your personal data, and to object to certain uses of it. Where
              such rights apply, we will honor them; the specific rights available to you depend
              on the law of your country, which this general policy does not attempt to enumerate.
            </p>
          </PolicySection>

          <PolicySection title="11. Security">
            <p>
              Passwords are stored using industry-standard hashing, never in plain text. Session
              cookies are HTTP-only and sent only over secure connections in production.
              Authorization checks (what a given account is allowed to see or do) are enforced on
              our servers, never taken on trust from the client. No system is completely
              risk-free, and we work to keep these protections current as the platform grows.
            </p>
          </PolicySection>
        </div>
      </div>
    </Section>
  );
}
