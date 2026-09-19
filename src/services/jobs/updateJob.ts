import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ApplicationMethod } from "@/generated/prisma/enums";
import { VALID_CURRENCY_CODES } from "@/constants/currencies";
import { getEmployerCompany } from "@/services/employers/getEmployerCompany";
import { findCategoryBySlug, findCityInCountry } from "@/services/jobs/referenceData";
import { isSafeExternalUrl } from "@/services/jobs/createJob";

export type UpdateJobInput = {
  /** Must come from the authenticated session — never client-supplied. */
  userId: string;
  jobId: string;
  title: string;
  description: string;
  citySlug: string;
  categorySlug: string;
  salaryMin: string;
  salaryMax: string;
  currencyCode: string;
  applicationMethod: string;
  externalApplicationUrl: string;
};

export type UpdateJobFieldErrors = Partial<
  Record<"title" | "description" | "city" | "category" | "salary" | "currency" | "applicationMethod" | "externalUrl", string>
>;

export type UpdateJobResult =
  | { success: true }
  | { success: false; fieldErrors: UpdateJobFieldErrors; formError?: string };

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 10000;

/**
 * Edits the content of an EXISTING job the authenticated employer owns.
 * Field-level validation deliberately mirrors createJob.ts's own rules
 * exactly (editing must never accept anything creation would have
 * rejected), following the same duplicate-not-shared pattern already
 * used by updateCandidateProfile.ts vs createCandidateProfile.ts in
 * this codebase, rather than extracting a shared helper that would put
 * createJob.ts's already-working behavior at risk.
 *
 * Deliberately NOT editable here: company (derived from the employer's
 * own session, exactly like creation), country (changing a job's
 * country after publication would change its URL/slug-uniqueness scope
 * and is not asked for by this task), slug (keeps the public URL
 * stable — no SEO-breaking silent redirect), status/expiresAt/
 * postedAt/closedAt (owned exclusively by the moderation and
 * close/reopen/expiry lifecycle functions, never by a content edit).
 *
 * Only allowed while status is `pending_review` or `active` — a
 * closed/expired/rejected job must be reopened (where that's itself
 * allowed) before its content can be edited again, per this task's own
 * capability table.
 */
export async function updateJob(input: UpdateJobInput): Promise<UpdateJobResult> {
  const fieldErrors: UpdateJobFieldErrors = {};

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

  const employerCompany = await getEmployerCompany(input.userId);
  if (!employerCompany) {
    return { success: false, fieldErrors: {}, formError: "Set up your company before managing jobs." };
  }

  const existingJob = await prisma.job.findFirst({
    where: { id: input.jobId, companyId: employerCompany.companyId, deletedAt: null },
    select: { id: true, status: true, countryId: true },
  });
  if (!existingJob) {
    return { success: false, fieldErrors: {}, formError: "Job not found." };
  }
  if (existingJob.status !== "pending_review" && existingJob.status !== "active") {
    return {
      success: false,
      fieldErrors: {},
      formError: "This job cannot be edited from its current state.",
    };
  }

  const city = await findCityInCountry(input.citySlug, existingJob.countryId);
  if (!city) {
    fieldErrors.city = "Please select a city that belongs to this job's country.";
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

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  const resolvedCity = city!;
  const resolvedCategory = category!;
  const resolvedApplicationMethod = applicationMethod!;

  try {
    await prisma.job.update({
      where: { id: existingJob.id },
      data: {
        title,
        description,
        cityId: resolvedCity.id,
        categoryId: resolvedCategory.id,
        applicationMethod: resolvedApplicationMethod,
        externalApplicationUrl:
          resolvedApplicationMethod === ApplicationMethod.external_url ? externalApplicationUrl : null,
        currencyCode: hasSalaryMin ? currencyCode : null,
        salaryMin: hasSalaryMin ? salaryMin : null,
        salaryMax: hasSalaryMax ? salaryMax : null,
      },
    });

    // Same stale-static-page reasoning as approveJob.ts/closeJob.ts: an
    // edited title/description on an already-active job would otherwise
    // keep showing the old content on /jobs and / until the next
    // deployment. Harmless no-op revalidation when the job is still
    // pending_review (not shown on either page yet either way).
    revalidatePath("/jobs");
    revalidatePath("/");

    return { success: true };
  } catch (error) {
    console.error("updateJob failed", error);
    return {
      success: false,
      fieldErrors: {},
      formError: "We couldn't save these changes right now. Please try again.",
    };
  }
}
