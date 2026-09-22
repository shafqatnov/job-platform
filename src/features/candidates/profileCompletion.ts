import type { CandidateProfileSummary } from "@/services/candidates/getCandidateProfile";

export type ProfileCompletionItem = {
  label: string;
  complete: boolean;
};

export type ProfileCompletion = {
  percent: number;
  items: ProfileCompletionItem[];
};

/**
 * Pure presentation logic — no database access, computed entirely from
 * the CandidateProfileSummary the caller already has. fullName and
 * country are excluded from the checklist: both are required at profile
 * creation (see createCandidateProfile.ts), so they are always present
 * and would make every profile show as "already 40% complete" for
 * fields the candidate never had a choice about. Only the genuinely
 * optional fields — headline, city, and resume — are counted, so 100%
 * always means "every optional field this candidate could add has been
 * added," never an invented or padded number.
 */
export function getProfileCompletion(profile: Pick<CandidateProfileSummary, "headline" | "cityName" | "hasResume">): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    { label: "Headline", complete: Boolean(profile.headline?.trim()) },
    { label: "City", complete: profile.cityName !== null },
    { label: "Resume", complete: profile.hasResume },
  ];

  const completeCount = items.filter((item) => item.complete).length;
  const percent = Math.round((completeCount / items.length) * 100);

  return { percent, items };
}
