import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { getConfiguredSiteUrl } from "@/lib/siteUrl";

const TITLE = "Contact";
const DESCRIPTION = "How to reach the Job Platform team for business, support, sales, and technical inquiries.";
const siteUrl = getConfiguredSiteUrl();
const path = "/contact";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(siteUrl ? { alternates: { canonical: `${siteUrl}${path}` } } : {}),
  openGraph: {
    title: `${TITLE} | Job Platform`,
    description: DESCRIPTION,
    type: "website",
    ...(siteUrl ? { url: `${siteUrl}${path}` } : {}),
  },
  twitter: {
    card: "summary",
    title: `${TITLE} | Job Platform`,
    description: DESCRIPTION,
  },
};

type ContactChannel = {
  label: string;
  description: string;
};

const CONTACT_CHANNELS: ContactChannel[] = [
  {
    label: "General / business inquiries",
    description: "For partnerships and general questions about the platform.",
  },
  {
    label: "Support",
    description: "For candidates and employers who need help with their account.",
  },
  {
    label: "Sales",
    description: "For employers interested in hiring at scale on the platform.",
  },
  {
    label: "Technical support",
    description: "For bug reports and technical issues with the site.",
  },
];

const SOCIAL_PLATFORMS = ["LinkedIn", "X (Twitter)"];

export default function ContactPage() {
  return (
    <Section aria-labelledby="contact-heading">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 text-center">
        <h1 id="contact-heading" className="text-2xl font-semibold text-foreground sm:text-3xl">
          Contact us
        </h1>
        <p className="text-muted-foreground">
          The channels below are being set up ahead of launch. Every contact point on this page is
          a placeholder — none of them are live addresses yet.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
        {CONTACT_CHANNELS.map((channel) => (
          <Card key={channel.label} padding="lg" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{channel.label}</h2>
              <Badge variant="warning">Placeholder — not yet configured</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{channel.description}</p>
            <p className="font-mono text-sm text-muted-foreground">To be confirmed before launch</p>
          </Card>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-4xl">
        <Card padding="lg" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Social</h2>
            <Badge variant="warning">Placeholder — not yet live</Badge>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {SOCIAL_PLATFORMS.map((platform) => (
              <li key={platform}>{platform} — coming soon</li>
            ))}
          </ul>
        </Card>
      </div>
    </Section>
  );
}
