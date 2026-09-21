import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  /** Omit on the last (current-page) item — it renders as plain text, not a link. */
  href?: string;
};

export type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

/**
 * Simple, reusable breadcrumb navigation — first used by the company
 * profile page, generic enough for any future page that needs one
 * (never company- or job-specific itself). Purely presentational: the
 * caller decides the trail; this renders it as an accessible <nav> with
 * an ordered list, the current page as plain (non-link) text, and a
 * visual separator between items. Does not itself add structured data —
 * see BreadcrumbJsonLd below for that, kept separate so a page can use
 * the visual trail without necessarily emitting schema.org markup, or
 * vice versa.
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-foreground hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? "text-foreground" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * schema.org BreadcrumbList JSON-LD for the same trail Breadcrumbs
 * renders visually — a distinct component (not folded into Breadcrumbs
 * itself) so a page can place the <script> tag wherever it needs to
 * relative to other structured data, matching how JobDetailPage already
 * builds its own JobPosting JSON-LD inline rather than inside a shared
 * component. `position` is 1-based per the schema.org spec. The final
 * item's `item` URL is intentionally omitted (schema.org convention for
 * "this page itself") to match how Breadcrumbs itself never links the
 * current page.
 */
export function breadcrumbJsonLd(items: BreadcrumbItem[], siteUrl: string | undefined): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href && siteUrl ? { item: `${siteUrl}${item.href}` } : {}),
    })),
  };
}
