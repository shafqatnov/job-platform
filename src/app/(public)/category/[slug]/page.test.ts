import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import CategoryPage, { generateMetadata, buildCategoryDescription } from "@/app/(public)/category/[slug]/page";
import { breadcrumbJsonLd } from "@/components/Breadcrumbs";
import {
  createModerationTestFixtures,
  createTestJob,
  cleanupModerationTestFixtures,
  type ModerationTestFixtures,
} from "@/test-utils/moderationFixtures";

/** generateMetadata() only reads `params`, but PageProps<'/category/[slug]'> requires `searchParams` too. */
function metadataFor(slug: string) {
  return generateMetadata({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) });
}

describe("buildCategoryDescription", () => {
  it("8. is unique and factual: derived only from the real category name and current counts, never invented statistics", () => {
    const text = buildCategoryDescription({ name: "Oil & Gas", openJobCount: 3, hiringCountries: [{ name: "UK", slug: "uk" }] });
    expect(text).toBe("3 open roles in Oil & Gas across 1 country on Jobnura.");
  });

  it("uses singular wording for exactly 1 role / 1 country", () => {
    const text = buildCategoryDescription({ name: "Nursing", openJobCount: 1, hiringCountries: [{ name: "UK", slug: "uk" }] });
    expect(text).toBe("1 open role in Nursing across 1 country on Jobnura.");
  });

  it("omits the country clause entirely when there are currently no hiring countries", () => {
    const text = buildCategoryDescription({ name: "Nursing", openJobCount: 0, hiringCountries: [] });
    expect(text).toBe("0 open roles in Nursing on Jobnura.");
  });
});

/**
 * /category/[slug]/page.tsx (real dev database, temporary fixtures).
 * Mirrors [country]/jobs/page.tsx's own generateMetadata test structure
 * exactly (same conditional-noindex pattern, same dynamic "find a
 * genuinely empty one" approach rather than hardcoding a slug).
 */
describe("/category/[slug] generateMetadata (real dev database, temporary fixtures)", () => {
  let fixtures: ModerationTestFixtures;
  let categorySlug: string;
  let categoryName: string;

  beforeAll(async () => {
    fixtures = await createModerationTestFixtures();
    const category = await prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { slug: true, name: true } });
    categorySlug = category.slug;
    categoryName = category.name;
  });

  afterAll(async () => {
    await cleanupModerationTestFixtures(fixtures);
  });

  it("2. an unknown category slug returns plain fallback metadata (no robots field, no DB assumption)", async () => {
    const metadata = await metadataFor("definitely-not-a-real-category-slug");
    expect(metadata.title).toBe("Jobs");
    expect(metadata.robots).toBeUndefined();
  });

  it("5 & 6. a known category with zero public jobs emits robots: { index: false, follow: true }", async () => {
    const metadata = await metadataFor(categorySlug);
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("6. a known category with at least one public job does not emit noindex", async () => {
    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Category Metadata Indexable Check", status: "active" });
    try {
      const metadata = await metadataFor(categorySlug);
      expect(metadata.robots).toBeUndefined();
    } finally {
      await prisma.job.delete({ where: { id: job.id } });
    }
  });

  it("6. a category becomes indexable automatically the instant it has its first public job, and reverts once it has none", async () => {
    const before = await metadataFor(categorySlug);
    expect(before.robots).toEqual({ index: false, follow: true });

    const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Category Becomes Indexable", status: "active" });
    const during = await metadataFor(categorySlug);
    expect(during.robots).toBeUndefined();

    await prisma.job.delete({ where: { id: job.id } });
    const after = await metadataFor(categorySlug);
    expect(after.robots).toEqual({ index: false, follow: true });
  });

  it("7. the title and description are unique to this category (derived from its own real name)", async () => {
    const metadata = await metadataFor(categorySlug);
    expect(metadata.title).toBe(`${categoryName} Jobs`);
    expect(String(metadata.description)).toContain(categoryName);
  });

  it("7. canonical is the category's own self-referencing /category/{slug} URL when a site URL is configured", async () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://canonical-test.invalid";
    try {
      const metadata = await metadataFor(categorySlug);
      expect(metadata.alternates?.canonical).toBe(`https://canonical-test.invalid/category/${categorySlug}`);
      expect(metadata.openGraph?.url).toBe(`https://canonical-test.invalid/category/${categorySlug}`);
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_SITE_URL;
      } else {
        process.env.NEXT_PUBLIC_SITE_URL = original;
      }
    }
  });
});

describe("CategoryPage default export", () => {
  it("2. an unknown category slug throws Next's notFound() error (digest NEXT_HTTP_ERROR_FALLBACK;404)", async () => {
    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: "definitely-not-a-real-category-slug" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("1 & 3. a known category renders with the real jobs/breadcrumb data, never throwing for a valid slug", async () => {
    const fixtures = await createModerationTestFixtures();
    try {
      const job = await createTestJob(fixtures, { title: "[AI MODERATION TEST] Category Page Render Check", status: "active" });
      const category = await prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId }, select: { slug: true, name: true } });
      try {
        const element = await CategoryPage({
          params: Promise.resolve({ slug: category.slug }),
          searchParams: Promise.resolve({}),
        });
        // The page returns a fragment: [breadcrumb <script>, <CategoryView>].
        const children = element.props.children as Array<{ type: unknown; props?: Record<string, unknown> }>;
        const categoryViewElement = children[1];
        expect(categoryViewElement.props?.category).toMatchObject({ slug: category.slug, name: category.name });
        const jobs = categoryViewElement.props?.jobs as Array<{ id: string }>;
        expect(jobs.some((j) => j.id === job.id)).toBe(true);
        expect(categoryViewElement.props?.breadcrumbItems).toEqual([
          { label: "Home", href: "/" },
          { label: "Jobs", href: "/jobs" },
          { label: `${category.name} Jobs` },
        ]);
      } finally {
        await prisma.job.delete({ where: { id: job.id } });
      }
    } finally {
      await cleanupModerationTestFixtures(fixtures);
    }
  });
});

describe("category breadcrumb structured data", () => {
  it("9. produces a valid, non-duplicated BreadcrumbList with 1-based positions and absolute non-final URLs", () => {
    const items = [
      { label: "Home", href: "/" },
      { label: "Jobs", href: "/jobs" },
      { label: "Mechanical Engineering Jobs" },
    ];
    const jsonLd = breadcrumbJsonLd(items, "https://www.jobnura.com") as {
      "@type": string;
      itemListElement: Array<{ "@type": string; position: number; item?: string }>;
    };
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement).toHaveLength(3);
    jsonLd.itemListElement.forEach((entry, index) => {
      expect(entry["@type"]).toBe("ListItem");
      expect(entry.position).toBe(index + 1);
    });
    expect(jsonLd.itemListElement[0].item).toBe("https://www.jobnura.com/");
    expect(jsonLd.itemListElement[1].item).toBe("https://www.jobnura.com/jobs");
    expect(jsonLd.itemListElement[2].item).toBeUndefined();
  });
});
