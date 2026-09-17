import Link from "next/link";
import { Container } from "@/components/Container";
import { FOOTER_LINK_GROUPS, type FooterLinkGroup } from "@/constants/navigation";

/** Site-wide footer: brand column, organized link groups, and a copyright line. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface-muted">
      <Container className="grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] lg:gap-8">
        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
            >
              J
            </span>
            <span className="text-lg font-semibold tracking-tight text-foreground">Job Platform</span>
          </Link>
          <p className="max-w-xs text-sm text-muted-foreground">
            Connecting candidates and employers across multiple countries and industries.
          </p>
        </div>
        {FOOTER_LINK_GROUPS.map((group) => (
          <FooterColumn key={group.title} group={group} />
        ))}
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Job Platform. All rights reserved.</p>
        </Container>
      </div>
    </footer>
  );
}

function FooterColumn({ group }: { group: FooterLinkGroup }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {group.title}
      </h2>
      <ul className="mt-4 flex flex-col gap-3">
        {group.links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
