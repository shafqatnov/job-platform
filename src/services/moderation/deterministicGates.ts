import { prisma } from "@/lib/prisma";
import { isSafeExternalUrl } from "@/services/jobs/createJob";

export type DeterministicGateFailureCode =
  | "not_found"
  | "not_pending"
  | "soft_deleted"
  | "missing_title"
  | "missing_description"
  | "missing_company"
  | "missing_country"
  | "missing_city"
  | "missing_category"
  | "invalid_application_method"
  | "missing_external_url"
  | "unsafe_external_url"
  | "already_expired"
  | "employer_account_not_active"
  | "source_not_authorized";

export type DeterministicGateResult = {
  passed: boolean;
  failures: DeterministicGateFailureCode[];
  /** Present only when the job could be loaded — used by later pipeline stages so they don't re-query. */
  job: DeterministicGateJob | null;
};

export type DeterministicGateJob = {
  id: string;
  title: string;
  description: string;
  companyId: string;
  companyName: string;
  countryId: string;
  countryName: string;
  cityId: string;
  cityName: string;
  categoryId: string;
  categoryName: string;
  applicationMethod: "on_platform" | "external_url";
  externalApplicationUrl: string | null;
  source: string;
};

/** The shape evaluateDeterministicGates needs — matches the Prisma select in runDeterministicGates exactly. */
export type FetchedJobForGates = {
  id: string;
  title: string;
  description: string;
  status: string;
  deletedAt: Date | null;
  source: string;
  applicationMethod: string;
  externalApplicationUrl: string | null;
  expiresAt: Date | null;
  company: { id: string; name: string } | null;
  country: { id: string; name: string } | null;
  city: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  postedBy: { status: string };
};

/** The list of source values currently authorized for automated processing (only one exists in the schema today). */
const AUTHORIZED_SOURCES: ReadonlySet<string> = new Set(["employer_direct"]);

/**
 * The pure evaluation logic — no I/O — so it can be unit-tested
 * directly with a hand-built job shape, including hypothetical cases
 * the current schema cannot yet produce (e.g. an unauthorized source
 * value, since JobSource has only one real value today).
 * runDeterministicGates (below) is the only real caller in production;
 * it fetches the job and delegates here.
 */
export function evaluateDeterministicGates(job: FetchedJobForGates): DeterministicGateResult {
  const failures: DeterministicGateFailureCode[] = [];

  if (job.deletedAt) {
    failures.push("soft_deleted");
  }
  if (job.status !== "pending_review") {
    failures.push("not_pending");
  }
  if (!job.title.trim()) {
    failures.push("missing_title");
  }
  if (!job.description.trim()) {
    failures.push("missing_description");
  }
  if (!job.company) {
    failures.push("missing_company");
  }
  if (!job.country) {
    failures.push("missing_country");
  }
  if (!job.city) {
    failures.push("missing_city");
  }
  if (!job.category) {
    failures.push("missing_category");
  }
  if (job.applicationMethod !== "on_platform" && job.applicationMethod !== "external_url") {
    failures.push("invalid_application_method");
  } else if (job.applicationMethod === "external_url") {
    if (!job.externalApplicationUrl) {
      failures.push("missing_external_url");
    } else if (!isSafeExternalUrl(job.externalApplicationUrl)) {
      failures.push("unsafe_external_url");
    }
  }
  if (job.expiresAt && job.expiresAt.getTime() <= Date.now()) {
    failures.push("already_expired");
  }
  if (job.postedBy.status !== "active") {
    failures.push("employer_account_not_active");
  }
  // Only one source value exists in the schema today (employer_direct)
  // — this check is a real gate, not a no-op, so it starts protecting
  // automated ingestion the moment a second source value is introduced.
  if (!AUTHORIZED_SOURCES.has(job.source)) {
    failures.push("source_not_authorized");
  }

  const hasValidApplicationMethod = job.applicationMethod === "on_platform" || job.applicationMethod === "external_url";

  const gateJob: DeterministicGateJob | null =
    job.company && job.country && job.city && job.category && hasValidApplicationMethod
      ? {
          id: job.id,
          title: job.title,
          description: job.description,
          companyId: job.company.id,
          companyName: job.company.name,
          countryId: job.country.id,
          countryName: job.country.name,
          cityId: job.city.id,
          cityName: job.city.name,
          categoryId: job.category.id,
          categoryName: job.category.name,
          applicationMethod: job.applicationMethod as "on_platform" | "external_url",
          externalApplicationUrl: job.externalApplicationUrl,
          source: job.source,
        }
      : null;

  return { passed: failures.length === 0, failures, job: gateJob };
}

/**
 * Re-verifies, independently and defensively, every safety-relevant
 * fact about a job before it can ever be eligible for automatic
 * publication — regardless of what createJob's own validation already
 * guaranteed at submission time (schema FK constraints mean company/
 * country/city/category always structurally resolve, but this function
 * does not assume that; it re-reads and re-checks everything fresh).
 *
 * This does not duplicate createJob's business rules — it reuses the
 * exact same external-URL safety check (isSafeExternalUrl) rather than
 * re-implementing it — but it DOES independently re-verify the result,
 * since a job read here could in principle have been altered by
 * something else after creation.
 *
 * Only ever call this for a job you intend to consider for automated
 * processing; it intentionally fails (not_pending) for anything not
 * currently pending_review, since that is the only state this pipeline
 * is allowed to act on.
 */
export async function runDeterministicGates(jobId: string): Promise<DeterministicGateResult> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      deletedAt: true,
      source: true,
      applicationMethod: true,
      externalApplicationUrl: true,
      expiresAt: true,
      company: { select: { id: true, name: true } },
      country: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      postedBy: { select: { status: true } },
    },
  });

  if (!job) {
    return { passed: false, failures: ["not_found"], job: null };
  }

  return evaluateDeterministicGates(job);
}
