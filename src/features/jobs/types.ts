/**
 * Shape of a single job as it will be returned by a future jobs service,
 * modeled on the approved schema in docs/26-database-schema-design.md
 * (Job entity's title/company/country/city/employmentType/salary fields).
 * Scoped to only what a list-view card needs to render — not the full
 * database row.
 */
export type JobListItem = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  countryCode: string;
  /** Public URL slug for the job's country — may differ from countryCode (e.g. "uk" vs "GB"). */
  countrySlug: string;
  countryName: string;
  city?: string;
  // Neither employmentType nor workMode exists as a column on Job yet
  // (see prisma/schema.prisma) — both stay optional so real query results
  // never need to fabricate a value for them.
  employmentType?: string;
  workMode?: string;
  salaryMin?: number;
  salaryMax?: number;
  currencyCode?: string;
  postedAt: string;
};
