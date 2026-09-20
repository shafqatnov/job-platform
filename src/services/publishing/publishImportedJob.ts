import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { slugify } from "@/utils/slugify";
import { approveJob } from "@/services/admin/moderateJob";
import { findResolvedLocationAlias } from "@/services/jobs/referenceData";
import type { ValidatableRawJob } from "@/services/validation/validateImportedJob";
import type { NormalizeImportedJobResult } from "@/services/ai/normalizeImportedJob";
import type { ImportedJobDecision } from "@/services/decision/decideImportedJobConfidence";

/**
 * The publishing stage of the imported-job pipeline — the ONLY module
 * allowed to turn an imported job into a real, public Jobnura Job row.
 * Sits after the confidence-decision stage:
 *
 *   Confidence Decision -> Publishing (this file) -> Public Job / Admin
 *   Review / Do Not Publish
 *
 * This module does NOT call OpenAI, does NOT re-run validation, and
 * does NOT re-derive the confidence decision — it only consumes what the
 * earlier stages already produced and turns it into: (a) a public Job
 * (auto_publish), (b) a queued ImportedJobReview row an admin must act
 * on (admin_review), or (c) a rejected, auditable ImportedJobReview row
 * (do_not_publish).
 *
 * COMPANY / EMPLOYER IDENTITY: an imported job still needs a real
 * Company row (Job.companyId is required), so the first time a source
 * company (e.g. "Acme Oil Co") is seen, a real Company row is created
 * for it (deduped by name, same pattern as createEmployerCompany.ts's
 * slug uniqueness loop). Critically, NO User and NO EmployerProfile is
 * EVER created for it — that absence is the actual permission boundary:
 * without an EmployerProfile, nobody can sign in and manage that
 * company's jobs, post new ones, or edit them. The Company row exists
 * purely so the job displays its real, correct employer name.
 *
 * POSTED-BY IDENTITY: Job.postedByUserId is also required. Every
 * imported job (whether auto-published or later admin-approved) is
 * attributed to ONE dedicated, shared "import system" User account,
 * created once and reused — never a per-source or per-company user. This
 * account has NO Account/credential row in Better Auth's own tables, so
 * — exactly like the imported Company above — it can never sign in or
 * be used to access anything; it exists solely to satisfy Job's existing
 * required relation. WHO approved a job (a real admin, or nobody for
 * auto_publish) is recorded separately via the existing ModerationAction
 * table, only for genuine human actions — never fabricated for
 * automated publishing.
 */

const IMPORT_SYSTEM_USER_EMAIL = "imports@jobnura.internal";
const MAX_SLUG_ATTEMPTS = 50;

export type PublishImportedJobResult =
  | { outcome: "published"; jobId: string; reviewId: string }
  | { outcome: "queued_for_review"; reviewId: string }
  | { outcome: "rejected"; reviewId: string }
  | { outcome: "failed"; error: string };

export type PublishImportedJobInput = {
  rawJob: ValidatableRawJob;
  normalization: NormalizeImportedJobResult;
  decision: ImportedJobDecision;
};

/**
 * Finds (or creates, once) the single shared system User every imported
 * job is attributed to. No Account row is ever created alongside it, so
 * it can never authenticate — see this module's own doc comment.
 */
async function getOrCreateImportSystemUser(): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email: IMPORT_SYSTEM_USER_EMAIL },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  try {
    const created = await prisma.user.create({
      data: {
        email: IMPORT_SYSTEM_USER_EMAIL,
        name: "Jobnura Import Engine",
        role: "employer",
        status: "active",
        emailVerified: false,
      },
      select: { id: true },
    });
    return created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // A concurrent publish attempt already created the system user —
      // reuse it instead of erroring.
      const raceWinner = await prisma.user.findUnique({ where: { email: IMPORT_SYSTEM_USER_EMAIL }, select: { id: true } });
      if (raceWinner) {
        return raceWinner.id;
      }
    }
    throw error;
  }
}

/**
 * Finds (case-insensitive, by name) or creates the real Company row for
 * an imported job's source company. NEVER creates an EmployerProfile —
 * see this module's own doc comment for why that absence matters.
 */
async function getOrCreateImportedCompany(companyName: string): Promise<string> {
  const name = companyName.trim();

  const existing = await prisma.company.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const baseSlug = slugify(name) || "imported-company";
  let slug = baseSlug;
  let attempt = 1;
  while (attempt <= MAX_SLUG_ATTEMPTS) {
    const collision = await prisma.company.findUnique({ where: { slug }, select: { id: true } });
    if (!collision) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }

  try {
    const created = await prisma.company.create({ data: { name, slug }, select: { id: true } });
    return created.id;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // A concurrent publish attempt already created this exact company
      // (same race the Job-level unique constraint guards against below)
      // — reuse it instead of erroring or creating a duplicate.
      const raceWinner = await prisma.company.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
      if (raceWinner) {
        return raceWinner.id;
      }
    }
    throw error;
  }
}

type ResolvedLocation = { countryId: string; cityId: string };

/**
 * Resolves an imported job's country and city to real reference-data
 * rows. Tries the AI-produced country/city names against the real
 * Country/City tables first — the normal path for a job whose location
 * text AI could already parse cleanly. If that fails (or AI couldn't
 * produce a country/city at all), falls back to a previously
 * admin-resolved mapping for this exact raw source location text (see
 * the ResolvedLocationAlias table and src/services/admin/locationReviews.ts)
 * so the same unrecognized location text never needs a second human
 * review. Returns null when neither path resolves both a country AND a
 * city — the caller then routes the job to the unknown-location review
 * queue rather than ever guessing or inventing a Country/City row.
 */
async function resolveCountryAndCity(
  aiCountryName: string | null,
  aiCityName: string | null,
  rawLocationText: string | null
): Promise<ResolvedLocation | null> {
  if (aiCountryName && aiCityName) {
    const country = await prisma.country.findFirst({ where: { name: aiCountryName }, select: { id: true } });
    if (country) {
      const city = await prisma.city.findFirst({
        where: { name: { equals: aiCityName, mode: "insensitive" }, countryId: country.id },
        select: { id: true },
      });
      if (city) {
        return { countryId: country.id, cityId: city.id };
      }
    }
  }

  if (rawLocationText) {
    const alias = await findResolvedLocationAlias(rawLocationText);
    if (alias && alias.cityId) {
      return { countryId: alias.countryId, cityId: alias.cityId };
    }
  }

  return null;
}

type ImportedJobReviewRow = Awaited<ReturnType<typeof prisma.importedJobReview.findFirst>>;

function reviewStatusForDecision(decision: ImportedJobDecision["decision"]): "pending" | "rejected" {
  return decision === "do_not_publish" ? "rejected" : "pending";
}

/**
 * Finds the existing review row for this exact external job if one
 * exists (idempotent across repeated importer runs on the same job), or
 * creates a fresh one otherwise. Never creates a second row for the same
 * (importedSourceId, importedExternalJobId) pair under normal
 * (non-racing) operation.
 */
async function findOrCreateReview(input: PublishImportedJobInput): Promise<{ review: NonNullable<ImportedJobReviewRow>; alreadyExisted: boolean }> {
  const { rawJob, normalization, decision } = input;

  const existing = await prisma.importedJobReview.findFirst({
    where: { importedSourceId: rawJob.sourceId, importedExternalJobId: rawJob.externalJobId },
  });
  if (existing) {
    return { review: existing, alreadyExisted: true };
  }

  const aiResult = normalization.ok ? normalization.result : null;

  const created = await prisma.importedJobReview.create({
    data: {
      importedSourceId: rawJob.sourceId,
      importedExternalJobId: rawJob.externalJobId,
      title: aiResult?.normalizedTitle || rawJob.title,
      description: aiResult?.normalizedDescription || rawJob.description || "",
      companyIdentity: rawJob.companyIdentity,
      location: rawJob.location,
      sourceUrl: rawJob.sourceUrl,
      category: aiResult?.category ?? null,
      country: aiResult?.country ?? null,
      city: aiResult?.city ?? null,
      decision: decision.decision,
      reasons: decision.reasons,
      status: reviewStatusForDecision(decision.decision),
    },
  });
  return { review: created, alreadyExisted: false };
}

/**
 * Marks a review row as published, tolerating the rare race where a
 * DIFFERENT review row (created by a genuinely concurrent call before
 * this one's findOrCreateReview could see it) already claimed the same
 * `publishedJobId` — that column is unique, so a second claim on the
 * same Job throws P2002. That's not a real failure: the Job IS
 * published and this function's caller already has the correct jobId
 * regardless of which review row ends up holding the reference.
 */
async function markReviewPublished(reviewId: string, jobId: string): Promise<void> {
  try {
    await prisma.importedJobReview.update({
      where: { id: reviewId },
      data: { status: "published", publishedJobId: jobId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return;
    }
    throw error;
  }
}

/**
 * Attempts to turn one "pending" ImportedJobReview into a real, public
 * Job. Race-safe: relies on Job's own
 * `@@unique([importedSourceId, importedExternalJobId])` constraint as
 * the actual guarantee (not just an in-memory check) — if a concurrent
 * call already published this exact external job, the resulting P2002
 * is caught and treated as success (idempotent), linking this review to
 * the winning Job rather than erroring or creating a second one.
 *
 * `actingAdminUserId` is null for automated auto_publish (no
 * ModerationAction is logged — there was no human action to record) and
 * set to the real admin's id when called from the admin-approval path
 * (a ModerationAction IS logged in that case).
 */
async function publishReview(
  review: NonNullable<ImportedJobReviewRow>,
  rawJob: ValidatableRawJob,
  normalization: NormalizeImportedJobResult,
  actingAdminUserId: string | null
): Promise<PublishImportedJobResult> {
  if (!normalization.ok) {
    return { outcome: "failed", error: "Cannot publish an imported job without a successful AI normalization result." };
  }
  const aiResult = normalization.result;

  // category/country are validated against Jobnura's real reference-data
  // vocabulary by normalizeImportedJob.ts itself, so a non-null value is
  // already guaranteed to match a real row — but city is deliberately
  // free-text (never invented, never vocabulary-constrained), so it may
  // not correspond to any real City row. If any required field can't be
  // resolved, this NEVER invents a fallback — it safely routes the job
  // to admin review instead, preserving the original decision for history.
  if (!aiResult.category || !rawJob.companyIdentity) {
    await prisma.importedJobReview.update({
      where: { id: review.id },
      data: { status: "pending", reasons: { push: "unresolvable_required_field" } },
    });
    return { outcome: "queued_for_review", reviewId: review.id };
  }

  const category = await prisma.category.findFirst({ where: { name: aiResult.category }, select: { id: true } });
  if (!category) {
    await prisma.importedJobReview.update({
      where: { id: review.id },
      data: { status: "pending", reasons: { push: "unresolvable_required_field" } },
    });
    return { outcome: "queued_for_review", reviewId: review.id };
  }

  // A location AI couldn't confidently map (and that no prior admin
  // resolution covers) is routed to the dedicated unknown-location
  // review queue via locationReviewStatus — distinct from the other
  // unresolvable-field cases above, which have no such queue. This
  // review row's OWN resolvedCountryId/resolvedCityId (set by an admin
  // via resolveLocationReview) take priority when present — the most
  // specific, directly-authoritative source — ahead of the AI-name
  // lookup and the raw-text alias fallback inside resolveCountryAndCity.
  const resolvedLocation: ResolvedLocation | null =
    review.resolvedCountryId && review.resolvedCityId
      ? { countryId: review.resolvedCountryId, cityId: review.resolvedCityId }
      : await resolveCountryAndCity(aiResult.country, aiResult.city, rawJob.location);
  if (!resolvedLocation) {
    await prisma.importedJobReview.update({
      where: { id: review.id },
      data: { status: "pending", locationReviewStatus: "pending", reasons: { push: "unresolvable_required_field" } },
    });
    return { outcome: "queued_for_review", reviewId: review.id };
  }
  const { countryId, cityId } = resolvedLocation;

  const [companyId, systemUserId] = await Promise.all([
    getOrCreateImportedCompany(rawJob.companyIdentity),
    getOrCreateImportSystemUser(),
  ]);

  const baseSlug = slugify(aiResult.normalizedTitle) || "imported-job";
  let slug = baseSlug;
  let attempt = 1;
  while (attempt <= MAX_SLUG_ATTEMPTS) {
    const collision = await prisma.job.findFirst({ where: { countryId, slug }, select: { id: true } });
    if (!collision) break;
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  if (attempt > MAX_SLUG_ATTEMPTS) {
    return { outcome: "failed", error: "Could not generate a unique listing URL for this imported job." };
  }

  let job: { id: string };
  try {
    job = await prisma.job.create({
      data: {
        companyId,
        countryId,
        cityId,
        categoryId: category.id,
        postedByUserId: systemUserId,
        title: aiResult.normalizedTitle,
        description: aiResult.normalizedDescription,
        slug,
        status: "pending_review",
        source: "imported",
        applicationMethod: "external_url",
        externalApplicationUrl: rawJob.sourceUrl ?? undefined,
        currencyCode: aiResult.salary?.currency ?? undefined,
        salaryMin: aiResult.salary?.min ?? undefined,
        salaryMax: aiResult.salary?.max ?? undefined,
        importedSourceId: rawJob.sourceId,
        importedExternalJobId: rawJob.externalJobId,
        importedSourceUpdatedAt: rawJob.updatedAt ? new Date(rawJob.updatedAt) : undefined,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // A concurrent publish attempt for this exact external job already
      // won — idempotent success, not a failure.
      const winningJob = await prisma.job.findUnique({
        where: {
          importedSourceId_importedExternalJobId: {
            importedSourceId: rawJob.sourceId,
            importedExternalJobId: rawJob.externalJobId,
          },
        },
        select: { id: true },
      });
      if (winningJob) {
        await markReviewPublished(review.id, winningJob.id);
        return { outcome: "published", jobId: winningJob.id, reviewId: review.id };
      }
    }
    console.error(`publishImportedJob: job creation failed for review ${review.id}`);
    return { outcome: "failed", error: "We couldn't publish this imported job right now." };
  }

  // Reuses the EXISTING, already-tested employer-approval logic in full
  // (status -> active, postedAt/expiresAt, public-page revalidation) —
  // no publishing invariant is duplicated or bypassed here.
  const approveResult = await approveJob(systemUserId, job.id);
  if (!approveResult.success) {
    console.error(`publishImportedJob: approveJob failed for job ${job.id}`);
    return { outcome: "failed", error: approveResult.error };
  }

  await markReviewPublished(review.id, job.id);

  if (actingAdminUserId) {
    await prisma.moderationAction.create({
      data: {
        adminUserId: actingAdminUserId,
        targetJobId: job.id,
        action: "approve_imported_job",
        reason: `Approved imported job review ${review.id}`,
      },
    });
  }

  return { outcome: "published", jobId: job.id, reviewId: review.id };
}

/**
 * The pipeline's entry point — call once per imported job that has
 * completed validation, duplicate detection, AI normalization, and
 * confidence decision. Idempotent across repeated importer runs: if this
 * exact external job was already processed on a previous run, its
 * existing, current state is returned without reprocessing it.
 */
export async function ingestImportedJob(input: PublishImportedJobInput): Promise<PublishImportedJobResult> {
  const { review, alreadyExisted } = await findOrCreateReview(input);

  if (alreadyExisted) {
    if (review.status === "published" && review.publishedJobId) {
      return { outcome: "published", jobId: review.publishedJobId, reviewId: review.id };
    }
    if (review.status === "rejected") {
      return { outcome: "rejected", reviewId: review.id };
    }
    // status is "pending". If the ORIGINAL decision (preserved forever
    // on the review, regardless of status) was auto_publish, this means
    // an earlier attempt never finished — most likely a genuinely
    // concurrent call whose own findOrCreateReview lost this exact race
    // by a few milliseconds. publishReview is itself idempotent/race-safe
    // (Job's unique constraint + markReviewPublished's own P2002
    // handling), so it's always safe to retry here rather than leaving
    // an auto_publish job stuck. A genuine admin_review item, by
    // contrast, must never be auto-retried — only a human action
    // (approveImportedJobReview/rejectImportedJobReview) may move it.
    if (review.decision === "auto_publish") {
      return publishReview(review, input.rawJob, input.normalization, null);
    }
    return { outcome: "queued_for_review", reviewId: review.id };
  }

  if (input.decision.decision === "do_not_publish") {
    return { outcome: "rejected", reviewId: review.id };
  }
  if (input.decision.decision === "admin_review") {
    return { outcome: "queued_for_review", reviewId: review.id };
  }

  return publishReview(review, input.rawJob, input.normalization, null);
}

export type ApproveImportedJobReviewResult = PublishImportedJobResult;

/**
 * The admin-approval action. Re-fetches the review row fresh (never
 * trusts a stale copy) and re-derives the raw job / normalization inputs
 * it needs from the review's own stored snapshot, so approval never
 * depends on the original importer run's in-memory state still being
 * around. Idempotent: approving an already-published review returns the
 * existing Job rather than creating another one.
 */
export async function approveImportedJobReview(
  reviewId: string,
  adminUserId: string
): Promise<ApproveImportedJobReviewResult> {
  const review = await prisma.importedJobReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return { outcome: "failed", error: "Imported job review not found." };
  }

  if (review.status === "published" && review.publishedJobId) {
    return { outcome: "published", jobId: review.publishedJobId, reviewId: review.id };
  }
  if (review.status === "rejected") {
    return { outcome: "failed", error: "This imported job has already been rejected and cannot be approved." };
  }

  // Re-validate against the review's own stored snapshot — never
  // re-fetches from Greenhouse or re-runs AI here (publishing must not
  // call OpenAI). This IS "re-check the job has not become invalid since
  // import": missing required fields on the snapshot are caught the same
  // way a fresh import would be. country/city are deliberately NOT
  // required here (unlike the other fields) — a review with no AI
  // country/city can still be publishable if an admin has since resolved
  // its raw location text via the unknown-location review queue;
  // publishReview's own resolveCountryAndCity re-checks that and safely
  // re-queues the review if the location genuinely still can't be resolved.
  if (!review.title.trim() || !review.companyIdentity || !review.category) {
    return { outcome: "failed", error: "This imported job is missing required information and cannot be published." };
  }

  const rawJob: ValidatableRawJob = {
    sourceId: review.importedSourceId,
    externalJobId: review.importedExternalJobId,
    title: review.title,
    location: review.location,
    description: review.description,
    sourceUrl: review.sourceUrl,
    updatedAt: "",
    rawSourceType: "ATS",
    companyIdentity: review.companyIdentity,
    departments: [],
    offices: [],
  };
  const normalization: NormalizeImportedJobResult = {
    ok: true,
    result: {
      sourceId: review.importedSourceId,
      externalJobId: review.importedExternalJobId,
      sourceUrl: review.sourceUrl,
      normalizedTitle: review.title,
      normalizedDescription: review.description,
      country: review.country,
      city: review.city,
      category: review.category,
      skills: [],
      experienceSummary: null,
      salary: null,
      employmentType: null,
      workArrangement: null,
      visaSponsorship: null,
      quality: { contentQuality: "good", concerns: [], missingImportantFields: [], suspiciousSignals: [] },
    },
  };

  return publishReview(review, rawJob, normalization, adminUserId);
}

export type RejectImportedJobReviewResult = { success: true } | { success: false; error: string };

/**
 * The admin-rejection action. Idempotent: rejecting an already-rejected
 * review is a safe no-op; rejecting an already-published one is refused
 * (a public Job must be taken down through the existing job-lifecycle
 * tools, not silently by this queue).
 */
export async function rejectImportedJobReview(
  reviewId: string,
  adminUserId: string
): Promise<RejectImportedJobReviewResult> {
  const review = await prisma.importedJobReview.findUnique({ where: { id: reviewId } });
  if (!review) {
    return { success: false, error: "Imported job review not found." };
  }
  if (review.status === "rejected") {
    return { success: true };
  }
  if (review.status === "published") {
    return { success: false, error: "This imported job has already been published and cannot be rejected here." };
  }

  await prisma.$transaction([
    prisma.importedJobReview.update({ where: { id: review.id }, data: { status: "rejected" } }),
    prisma.moderationAction.create({
      data: {
        adminUserId,
        targetJobId: null,
        action: "reject_imported_job",
        reason: `Rejected imported job review ${review.id} ("${review.title}")`,
      },
    }),
  ]);

  return { success: true };
}
