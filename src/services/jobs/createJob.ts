import { prisma } from "@/lib/prisma";
import { ApplicationMethod } from "@/generated/prisma/enums";
import { slugify } from "@/utils/slugify";
import { VALID_CURRENCY_CODES } from "@/constants/currencies";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { findCountryBySlug, findCategoryBySlug, findCityInCountry } from "@/services/jobs/referenceData";

export type CreateJobInput = {
  /** Must come from the authenticated session — never client-supplied. */
  userId: string;
  title: string;
  description: string;
  countrySlug: string;
  citySlug: string;
  categorySlug: string;
  salaryMin: string;
  salaryMax: string;
  currencyCode: string;
  applicationMethod: string;
  externalApplicationUrl: string;
  /** Optional — an empty string means "no expiry requested," matching every other optional field in this input. */
  expiryDate: string;
};

export type CreateJobFieldErrors = Partial<
  Record<
    | "title"
    | "description"
    | "country"
    | "city"
    | "category"
    | "salary"
    | "currency"
    | "applicationMethod"
    | "externalUrl"
    | "expiryDate",
    string
  >
>;

export type CreateJobResult =
  | { success: true; jobId: string; slug: string; countrySlug: string }
  | { success: false; fieldErrors: CreateJobFieldErrors; formError?: string };

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;
const MAX_SLUG_ATTEMPTS = 50;

/** Exported for reuse by the moderation pipeline's deterministic gates — the same rule, not a duplicate one. */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Creates one job on behalf of the authenticated employer. This is the
 * ONLY place allowed to write a Job row from the employer flow — UI
 * components and Server Actions must call this, never Prisma directly.
 *
 * Every field is re-validated here regardless of what client-side
 * validation already did (docs/17's minimum-content rule: non-empty
 * title/description/location/company association). Country/city/
 * category are resolved from real database rows by slug — a client
 * cannot supply an id directly. The employer's company is derived
 * server-side from their own EmployerProfile — never from client input.
 *
 * Initial lifecycle state is `pending_review` (the default), per
 * docs/18-job-lifecycle.md: only an admin-approval transition moves a
 * job to `active`. postedAt always stays null until that step.
 * expiresAt stays null too UNLESS the employer explicitly requested a
 * listing expiry at submission (see the "Version 1.1 optional expiry"
 * validation above) — approval preserves an employer-requested value
 * instead of overwriting it with the platform default.
 */
export async function createJob(input: CreateJobInput): Promise<CreateJobResult> {
  const fieldErrors: CreateJobFieldErrors = {};

  const title = input.title.trim();
  const description = input.description.trim();

  if (!title) {
    fieldErrors.title = "Title is required.";
  } else if (title.length > MAX_TITLE_LENGTH) {
    fieldErrors.title = `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`;
  }

  if (!description) {
    fieldErrors.description = "Description is required.";
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    fieldErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`;
  }

  const country = await findCountryBySlug(input.countrySlug);
  if (!country) {
    fieldErrors.country = "Please select a valid country.";
  }

  const city = country ? await findCityInCountry(input.citySlug, country.id) : null;
  if (country && !city) {
    fieldErrors.city = "Please select a city that belongs to the selected country.";
  }

  const category = await findCategoryBySlug(input.categorySlug);
  if (!category) {
    fieldErrors.category = "Please select a valid category.";
  }

  const salaryMinRaw = input.salaryMin.trim();
  const salaryMaxRaw = input.salaryMax.trim();
  const currencyCode = input.currencyCode.trim().toUpperCase();
  const hasSalaryMin = salaryMinRaw.length > 0;
  const hasSalaryMax = salaryMaxRaw.length > 0;
  let salaryMin: number | undefined;
  let salaryMax: number | undefined;

  if (hasSalaryMin || hasSalaryMax) {
    if (!hasSalaryMin || !hasSalaryMax) {
      fieldErrors.salary = "Provide both a minimum and maximum salary, or leave both blank.";
    } else {
      salaryMin = Number(salaryMinRaw);
      salaryMax = Number(salaryMaxRaw);
      if (!Number.isFinite(salaryMin) || !Number.isFinite(salaryMax) || salaryMin < 0 || salaryMax < 0) {
        fieldErrors.salary = "Salary values must be positive numbers.";
      } else if (salaryMin > salaryMax) {
        fieldErrors.salary = "Minimum salary cannot be greater than maximum salary.";
      }
    }

    if (!fieldErrors.salary) {
      if (!currencyCode) {
        fieldErrors.currency = "Currency is required when a salary is provided.";
      } else if (!VALID_CURRENCY_CODES.has(currencyCode)) {
        fieldErrors.currency = "Please select a supported currency.";
      }
    }
  }

  const rawApplicationMethod = input.applicationMethod.trim();
  const externalApplicationUrl = input.externalApplicationUrl.trim();
  const applicationMethod: ApplicationMethod | undefined =
    rawApplicationMethod === ApplicationMethod.on_platform || rawApplicationMethod === ApplicationMethod.external_url
      ? rawApplicationMethod
      : undefined;

  if (!applicationMethod) {
    fieldErrors.applicationMethod = "Please select how candidates should apply.";
  } else if (applicationMethod === ApplicationMethod.external_url) {
    if (!externalApplicationUrl) {
      fieldErrors.externalUrl = "An application URL is required for this method.";
    } else if (!isSafeExternalUrl(externalApplicationUrl)) {
      fieldErrors.externalUrl = "Please enter a valid http:// or https:// URL.";
    }
  }

  // Optional employer-requested expiry (docs/18's employer-editable
  // listing duration). Left unset (null), the existing default — applied
  // at approval time, see approveJob.ts/autoApproveJob.ts — is unchanged.
  // Validated the same way any other date input in this codebase would
  // be: plain `Date` parsing against the server's own clock, no
  // per-country/per-user timezone conversion (none exists anywhere else
  // in this app, so none is invented here either).
  const rawExpiryDate = input.expiryDate.trim();
  let expiryDate: Date | null = null;
  if (rawExpiryDate) {
    const parsed = new Date(rawExpiryDate);
    if (Number.isNaN(parsed.getTime())) {
      fieldErrors.expiryDate = "Please enter a valid expiry date and time.";
    } else if (parsed <= new Date()) {
      fieldErrors.expiryDate = "Expiry date must be in the future.";
    } else {
      expiryDate = parsed;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  // All required lookups succeeded (fieldErrors is empty), so these are
  // guaranteed non-null past this point.
  const resolvedCountry = country!;
  const resolvedCity = city!;
  const resolvedCategory = category!;
  const resolvedApplicationMethod = applicationMethod!;

  const employerCompany = await getEmployerCompany(input.userId);
  if (!employerCompany) {
    return {
      success: false,
      fieldErrors: {},
      formError: "Set up your company before posting a job.",
    };
  }

  const baseSlug = slugify(title) || "job";
  let slug = baseSlug;
  let attempt = 1;

  while (attempt <= MAX_SLUG_ATTEMPTS) {
    const collision = await prisma.job.findFirst({
      where: { countryId: resolvedCountry.id, slug },
      select: { id: true },
    });
    if (!collision) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  if (attempt > MAX_SLUG_ATTEMPTS) {
    return {
      success: false,
      fieldErrors: {},
      formError: "Could not generate a unique listing URL. Please adjust the title and try again.",
    };
  }

  try {
    const job = await prisma.job.create({
      data: {
        companyId: employerCompany.companyId,
        countryId: resolvedCountry.id,
        cityId: resolvedCity.id,
        categoryId: resolvedCategory.id,
        postedByUserId: input.userId,
        title,
        description,
        slug,
        applicationMethod: resolvedApplicationMethod,
        externalApplicationUrl:
          resolvedApplicationMethod === ApplicationMethod.external_url ? externalApplicationUrl : null,
        currencyCode: hasSalaryMin ? currencyCode : null,
        salaryMin: hasSalaryMin ? salaryMin : null,
        salaryMax: hasSalaryMax ? salaryMax : null,
        // status defaults to pending_review; postedAt stays null until
        // approval. expiresAt is set here ONLY if the employer requested
        // one — while status is pending_review this is completely inert
        // (every public-read path and the expiry cron require status =
        // active first), and approveJob.ts/autoApproveJob.ts preserve it
        // instead of overwriting it with the default duration once the
        // job goes active. Left null (the common case), approval sets
        // the existing default exactly as before this field existed.
        expiresAt: expiryDate,
      },
      select: { id: true, slug: true },
    });

    return { success: true, jobId: job.id, slug: job.slug, countrySlug: resolvedCountry.slug };
  } catch (error) {
    console.error("createJob failed", error);
    return {
      success: false,
      fieldErrors: {},
      formError: "We couldn't save this job right now. Please try again.",
    };
  }
}
