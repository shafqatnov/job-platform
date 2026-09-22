import { describe, expect, it } from "vitest";
import { buildJobBreadcrumbItems } from "@/app/(public)/[country]/jobs/[slug]/page";
import { breadcrumbJsonLd } from "@/components/Breadcrumbs";

const country = { slug: "uk", name: "United Kingdom" };
const jobWithCategory = {
  title: "Mobile Vehicle Technician",
  categorySlug: "mechanical-engineering",
  categoryName: "Mechanical Engineering",
};

/**
 * buildJobBreadcrumbItems (pure — no DB/request access). The job detail
 * page's own default export can't be called directly in a unit test:
 * it unconditionally calls getSessionUser(), which calls next/headers'
 * headers() and throws "called outside a request scope" outside real
 * Next.js rendering (confirmed by running it). Breadcrumb construction
 * was pulled out into this small pure function specifically so it stays
 * testable without mocking next/headers (no existing precedent for that
 * in this codebase) or otherwise inventing new test infrastructure.
 */
describe("buildJobBreadcrumbItems", () => {
  it("2. Home is the first breadcrumb with href '/'", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    expect(items[0]).toEqual({ label: "Home", href: "/" });
  });

  it("3. the country breadcrumb links to the existing canonical /{country}/jobs URL", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    expect(items[1]).toEqual({ label: "United Kingdom Jobs", href: "/uk/jobs" });
  });

  it("4. the category breadcrumb is included when the job has a real category, using the existing ?category= filter (never an invented route)", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    expect(items[2]).toEqual({
      label: "Mechanical Engineering",
      href: "/uk/jobs?category=mechanical-engineering",
    });
  });

  it("4. the category breadcrumb is omitted when category data is genuinely absent", () => {
    const items = buildJobBreadcrumbItems(country, { ...jobWithCategory, categorySlug: "", categoryName: "" });
    expect(items).toEqual([
      { label: "Home", href: "/" },
      { label: "United Kingdom Jobs", href: "/uk/jobs" },
      { label: "Mobile Vehicle Technician" },
    ]);
  });

  it("5. the job title is the final breadcrumb, with no href (matches the example trail exactly)", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    expect(items).toEqual([
      { label: "Home", href: "/" },
      { label: "United Kingdom Jobs", href: "/uk/jobs" },
      { label: "Mechanical Engineering", href: "/uk/jobs?category=mechanical-engineering" },
      { label: "Mobile Vehicle Technician" },
    ]);
  });
});

/**
 * breadcrumbJsonLd(buildJobBreadcrumbItems(...)) — the exact same shared
 * helper CompanyProfilePage already uses, given this job page's own
 * trail as input.
 */
describe("job detail breadcrumb structured data", () => {
  it("6. produces a valid BreadcrumbList with 1-based positions and every non-final item's absolute URL", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    const jsonLd = breadcrumbJsonLd(items, "https://www.jobnura.com") as {
      "@type": string;
      itemListElement: Array<{ "@type": string; position: number; name: string; item?: string }>;
    };

    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toHaveLength(4);
    jsonLd.itemListElement.forEach((entry, index) => {
      expect(entry["@type"]).toBe("ListItem");
      expect(entry.position).toBe(index + 1);
    });
    expect(jsonLd.itemListElement[0].item).toBe("https://www.jobnura.com/");
    expect(jsonLd.itemListElement[1].item).toBe("https://www.jobnura.com/uk/jobs");
    expect(jsonLd.itemListElement[2].item).toBe(
      "https://www.jobnura.com/uk/jobs?category=mechanical-engineering"
    );
  });

  it("5 & 6. the final (job title) item has no `item` URL, per the existing BreadcrumbList convention for the current page", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    const jsonLd = breadcrumbJsonLd(items, "https://www.jobnura.com") as {
      itemListElement: Array<{ name: string; item?: string }>;
    };
    const last = jsonLd.itemListElement[jsonLd.itemListElement.length - 1];
    expect(last.name).toBe("Mobile Vehicle Technician");
    expect(last.item).toBeUndefined();
  });

  it("7. calling it twice for the same page produces one equivalent BreadcrumbList each time, never an accumulating/duplicated list", () => {
    const items = buildJobBreadcrumbItems(country, jobWithCategory);
    const first = breadcrumbJsonLd(items, "https://www.jobnura.com");
    const second = breadcrumbJsonLd(items, "https://www.jobnura.com");
    expect(first).toEqual(second);
  });
});
