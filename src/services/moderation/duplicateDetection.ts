import { prisma } from "@/lib/prisma";

export type DuplicateMatchLevel = "no_match" | "possible_duplicate" | "likely_duplicate";

export type DuplicateEvidence = {
  matchedJobId: string;
  matchedJobTitle: string;
  matchType: "normalized_title_company_city" | "normalized_title_company_country";
};

export type DuplicateAnalysisResult = {
  level: DuplicateMatchLevel;
  evidence: DuplicateEvidence[];
};

/**
 * Lowercase, whitespace-collapsed, punctuation-stripped — exactly
 * docs/17-job-sourcing-and-content-integrity.md's documented first
 * implementation of duplicate detection. Not a hash, not fuzzy/semantic
 * matching (that is explicitly [DEFERRED] in the same doc) — this is
 * the one, real, approved algorithm.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compares one job against the same employer's other live listings
 * (active or pending_review — a rejected/expired/soft-deleted job is
 * not grounds for flagging a new, possibly-resubmitted one). Returns a
 * graduated, explainable result — never a bare boolean, and never
 * claimed as certain, per this task's explicit "do not claim
 * mathematical certainty" requirement.
 *
 * This does not create, modify, or delete anything — it only reads.
 * Deciding what to do with the result (e.g. never auto-publish a
 * likely_duplicate) is the caller's responsibility.
 */
export async function analyzeDuplicates(job: {
  id: string;
  title: string;
  companyId: string;
  countryId: string;
  cityId: string;
}): Promise<DuplicateAnalysisResult> {
  const normalizedTarget = normalizeTitle(job.title);

  const candidates = await prisma.job.findMany({
    where: {
      companyId: job.companyId,
      id: { not: job.id },
      deletedAt: null,
      status: { in: ["active", "pending_review"] },
    },
    select: { id: true, title: true, countryId: true, cityId: true },
  });

  const evidence: DuplicateEvidence[] = [];
  let level: DuplicateMatchLevel = "no_match";

  for (const candidate of candidates) {
    if (normalizeTitle(candidate.title) !== normalizedTarget) {
      continue;
    }

    if (candidate.countryId === job.countryId && candidate.cityId === job.cityId) {
      evidence.push({
        matchedJobId: candidate.id,
        matchedJobTitle: candidate.title,
        matchType: "normalized_title_company_city",
      });
      level = "likely_duplicate";
    } else if (candidate.countryId === job.countryId) {
      evidence.push({
        matchedJobId: candidate.id,
        matchedJobTitle: candidate.title,
        matchType: "normalized_title_company_country",
      });
      if (level !== "likely_duplicate") {
        level = "possible_duplicate";
      }
    }
  }

  return { level, evidence };
}
