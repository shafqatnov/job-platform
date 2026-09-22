import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Contact";
const DESCRIPTION = "How to reach Jobnura for support, employer enquiries, privacy requests, and feedback.";
const siteUrl = getConfiguredSiteUrl();
const path = "/contact";
const CONTACT_EMAIL = "jobnuraglobal@gmail.com";

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

const CONTACT_REASONS = [
  "General support for candidates and employers",
  "Employer enquiries",
  "Privacy requests, including accessing, correcting, or deleting your data",
  "Reporting incorrect or outdated job information",
  "General feedback about the platform",
];

export default function ContactPage() {
  return (
    <Section aria-labelledby="contact-heading">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 text-center">
        <h1 id="contact-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Contact Jobnura
        </h1>
        <p className="text-muted-foreground">
          If you have a question or need help, reach out to us by email. You can contact us about:
        </p>
        <ul className="mx-auto flex flex-col gap-1 text-left text-muted-foreground">
          {CONTACT_REASONS.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-10 max-w-md">
        <Card padding="lg" className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">Email us at</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-mono text-base font-medium text-brand-600 hover:text-brand-700"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="text-sm text-muted-foreground">We aim to respond within 2–3 business days.</p>
        </Card>
      </div>
    </Section>
  );
}
