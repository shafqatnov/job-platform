import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { findCategoryBySlug } from "@/services/jobs/referenceData";
import { publicJobVisibilityWhere } from "@/services/jobs/publicJobVisibility";

/**
 * Read-only data for the /oil-and-gas hub. Oil & Gas is a strategic
 * vertical inside Jobnura's global platform, not a separate product —
 * this reads the same real Category/Country/Company/Job rows every
 * other public page reads, through the same publicJobVisibilityWhere()
 * rule, never a new data model or a second category/company system.
 *
 * Category.parentCategoryId (the schema's own hierarchy field) is
 * confirmed unused in this database — zero rows have a parent — so
 * there is no real parent/child relationship to derive "Oil & Gas
 * subcategories" from. Per this task's own instruction to fall back to
 * "only explicit existing categories" when no real hierarchy exists,
 * the categories below are hardcoded to the ones whose own name is
 * unambiguously oil & gas — never a guessed or invented slug, and
 * never a runtime AI classification pass over every public job.
 *
 * Deliberately excluded from this hub's own "qualifying" job count:
 * broader categories like Mechanical Engineering or Energy. A
 * "Mechanical Engineering" job could genuinely belong to any industry
 * (this database's own real example today is a roadside-assistance
 * company's vehicle technician role, not an oil & gas job) — counting
 * it as "Oil & Gas" would misrepresent unrelated employers/jobs as
 * hiring for this vertical. Those broader categories are instead shown
 * separately, in RELATED_ENGINEERING_CATEGORY_SLUGS, as honestly-labeled
 * adjacent fields a candidate may also want to browse — never claimed to
 * be oil & gas roles themselves. This is a known, reported classification
 * limitation: this hub can only be as precise as the real category data
 * already recorded on each Job.
 */
export const OIL_AND_GAS_CATEGORY_SLUGS = ["oil-gas", "petroleum", "drilling", "offshore"] as const;

/**
 * Broader engineering/energy/industrial categories that are plausible
 * adjacent fields for an oil & gas hub visitor, per this task's own
 * example list — shown only when genuinely populated (see
 * getRelatedEngineeringCategories below), and always labeled as their
 * own real category, never folded into the "Oil & Gas" job count itself.
 */
export const RELATED_ENGINEERING_CATEGORY_SLUGS = [
  "mechanical-engineering",
  "electrical-engineering",
  "civil-engineering",
  "chemical-engineering",
  "energy",
  "construction",
  "mining",
] as const;

export type OilAndGasHiringCountry = { name: string; slug: string };
export type OilAndGasHiringCompany = { name: string; slug: string; openJobCount: number };
export type OilAndGasCoreCategory = { slug: string; name: string; openJobCount: number };
export type OilAndGasRelatedCategory = { slug: string; name: string; openJobCount: number };

export type OilAndGasHubData = {
  totalJobCount: number;
  hiringCountries: OilAndGasHiringCountry[];
  hiringCompanies: OilAndGasHiringCompany[];
  coreCategories: OilAndGasCoreCategory[];
  relatedCategories: OilAndGasRelatedCategory[];
};

function dedupeByKey<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.set(k, item);
    }
  }
  return Array.from(seen.values());
}

/**
 * Wrapped in React's cache() — same pattern as getPublicCategoryBySlug —
 * so /oil-and-gas/page.tsx's generateMetadata() and its default-exported
 * page component share one set of queries per request instead of
 * running them twice.
 *
 * A single prisma.job.findMany() covers BOTH the core and the related
 * categories at once (categoryId in the combined set), then splits the
 * results in memory — one public-job query, never one per category and
 * never a full-table fetch.
 */
export const getOilAndGasHubData = cache(async (): Promise<OilAndGasHubData> => {
  const [coreCategoryRows, relatedCategoryRows] = await Promise.all([
    Promise.all(OIL_AND_GAS_CATEGORY_SLUGS.map((slug) => findCategoryBySlug(slug))),
    Promise.all(RELATED_ENGINEERING_CATEGORY_SLUGS.map((slug) => findCategoryBySlug(slug))),
  ]);
  // findCategoryBySlug returns null for a slug with no matching real
  // Category row — filtered out defensively rather than assumed; every
  // slug above was confirmed to exist at the time this hub was built,
  // but a row could in principle be renamed/removed later.
  const coreCategories = coreCategoryRows.filter((c): c is NonNullable<typeof c> => c !== null);
  const relatedCategoryRefs = relatedCategoryRows.filter((c): c is NonNullable<typeof c> => c !== null);
  const coreCategoryIds = new Set(coreCategories.map((c) => c.id));
  const relatedCategoryIds = new Set(relatedCategoryRefs.map((c) => c.id));

  const jobs = await prisma.job.findMany({
    where: {
      AND: [publicJobVisibilityWhere(), { categoryId: { in: [...coreCategoryIds, ...relatedCategoryIds] } }],
    },
    select: {
      categoryId: true,
      category: { select: { slug: true, name: true } },
      country: { select: { name: true, urlSlug: true } },
      company: { select: { slug: true, name: true } },
    },
  });

  const coreJobs = jobs.filter((job) => coreCategoryIds.has(job.categoryId));
  const relatedJobs = jobs.filter((job) => relatedCategoryIds.has(job.categoryId));

  const hiringCountries = dedupeByKey(
    coreJobs.map((job) => ({ name: job.country.name, slug: job.country.urlSlug })),
    (c) => c.slug
  );

  const companyCounts = new Map<string, OilAndGasHiringCompany>();
  for (const job of coreJobs) {
    const existing = companyCounts.get(job.company.slug);
    if (existing) {
      existing.openJobCount += 1;
    } else {
      companyCounts.set(job.company.slug, { name: job.company.name, slug: job.company.slug, openJobCount: 1 });
    }
  }

  // Always includes all four core categories, even at 0 — these define
  // the hub itself, so a temporarily-empty one is genuine, useful
  // information (never hidden the way an unrelated "other categories"
  // grab-bag would hide an empty entry).
  const coreCategoryCounts = new Map<string, number>();
  for (const job of coreJobs) {
    coreCategoryCounts.set(job.category.slug, (coreCategoryCounts.get(job.category.slug) ?? 0) + 1);
  }
  const coreCategoriesResult: OilAndGasCoreCategory[] = coreCategories.map((category) => ({
    slug: category.slug,
    name: category.name,
    openJobCount: coreCategoryCounts.get(category.slug) ?? 0,
  }));

  // Related categories are shown only when genuinely populated — a
  // discovery/bonus section, not the hub's own defining scope.
  const relatedCategoryCounts = new Map<string, OilAndGasRelatedCategory>();
  for (const job of relatedJobs) {
    const existing = relatedCategoryCounts.get(job.category.slug);
    if (existing) {
      existing.openJobCount += 1;
    } else {
      relatedCategoryCounts.set(job.category.slug, {
        slug: job.category.slug,
        name: job.category.name,
        openJobCount: 1,
      });
    }
  }

  return {
    totalJobCount: coreJobs.length,
    hiringCountries,
    hiringCompanies: Array.from(companyCounts.values()),
    coreCategories: coreCategoriesResult,
    relatedCategories: Array.from(relatedCategoryCounts.values()),
  };
});
