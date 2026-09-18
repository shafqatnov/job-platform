import Link from "next/link";
import { Badge } from "@/components/Badge";
import type { DeterministicGateFailureCode } from "@/services/moderation/deterministicGates";
import type { DuplicateAnalysisResult } from "@/services/moderation/duplicateDetection";
import type { AiProviderResult } from "@/services/ai/types";

export type ModerationSignalsPanelProps = {
  deterministicPassed: boolean;
  deterministicFailures: DeterministicGateFailureCode[];
  duplicateAnalysis: DuplicateAnalysisResult;
  /** null when no provider is configured/enabled — the panel then shows the existing "not configured" message, unchanged. */
  aiResult: AiProviderResult | null;
  aiProviderName: string;
};

const DECISION_VARIANTS: Record<string, "success" | "warning" | "danger"> = {
  approve: "success",
  review: "warning",
  reject: "danger",
};

const FAILURE_LABELS: Record<DeterministicGateFailureCode, string> = {
  not_found: "Job could not be loaded",
  not_pending: "Job is not currently pending review",
  soft_deleted: "Job has been deleted",
  missing_title: "Title is missing",
  missing_description: "Description is missing",
  missing_company: "Company association is missing",
  missing_country: "Country is missing",
  missing_city: "City is missing",
  missing_category: "Category is missing",
  invalid_application_method: "Application method is invalid",
  missing_external_url: "External application URL is missing",
  unsafe_external_url: "External application URL is unsafe or malformed",
  already_expired: "Job has already expired",
  employer_account_not_active: "Submitting employer's account is not active",
  source_not_authorized: "Job source is not authorized for automated processing",
};

const DUPLICATE_LABELS: Record<DuplicateAnalysisResult["level"], { label: string; variant: "neutral" | "warning" | "danger" }> = {
  no_match: { label: "No duplicate detected", variant: "neutral" },
  possible_duplicate: { label: "Possible duplicate", variant: "warning" },
  likely_duplicate: { label: "Likely duplicate", variant: "danger" },
};

/**
 * Live-computed moderation signals for one job — deterministic gate
 * results and duplicate-detection evidence are cheap, pure reads and
 * are recomputed fresh on every view (never persisted, since no
 * approved schema location for AI/moderation findings currently
 * exists — see this task's final report).
 *
 * AI analysis (`aiResult`) is only ever non-null when the caller has
 * both configured OPENAI_API_KEY and explicitly opted in via
 * AI_MODERATION_PROVIDER=openai (see resolveModerationProvider.ts) —
 * an operator must consciously accept the per-view API cost before
 * this panel ever makes a live call. When aiResult is null, this
 * renders the exact same "not configured" message as before this
 * task, unchanged.
 */
export function ModerationSignalsPanel({
  deterministicPassed,
  deterministicFailures,
  duplicateAnalysis,
  aiResult,
  aiProviderName,
}: ModerationSignalsPanelProps) {
  const duplicateDisplay = DUPLICATE_LABELS[duplicateAnalysis.level];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Deterministic validation</h3>
        {deterministicPassed ? (
          <Badge variant="success">All checks passed</Badge>
        ) : (
          <ul className="flex flex-col gap-1">
            {deterministicFailures.map((failure) => (
              <li key={failure}>
                <Badge variant="danger">{FAILURE_LABELS[failure]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">Duplicate check</h3>
        <Badge variant={duplicateDisplay.variant}>{duplicateDisplay.label}</Badge>
        {duplicateAnalysis.evidence.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            {duplicateAnalysis.evidence.map((evidence) => (
              <li key={evidence.matchedJobId}>
                Matches{" "}
                <Link
                  href={`/admin/jobs/${evidence.matchedJobId}`}
                  className="text-brand-600 hover:text-brand-700"
                >
                  {evidence.matchedJobTitle}
                </Link>{" "}
                ({evidence.matchType === "normalized_title_company_city" ? "same company & city" : "same company & country"})
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-foreground">AI analysis</h3>
        {aiResult === null ? (
          <p className="text-sm text-muted-foreground">
            No AI moderation provider is configured in this environment, so this job requires manual review.
          </p>
        ) : aiResult.ok ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={DECISION_VARIANTS[aiResult.output.decision] ?? "neutral"}>
                {aiResult.output.decision}
              </Badge>
              <span className="text-xs text-muted-foreground">via {aiProviderName}</span>
            </div>
            {aiResult.output.reasonCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {aiResult.output.reasonCodes.map((code) => (
                  <Badge key={code} variant="neutral">
                    {code}
                  </Badge>
                ))}
              </div>
            ) : null}
            {aiResult.output.suspectedDuplicate ? (
              <Badge variant="warning">AI suspects duplicate content</Badge>
            ) : null}
            <p className="text-sm text-muted-foreground">{aiResult.output.explanation}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            AI analysis unavailable ({aiResult.failureReason}) — this job requires manual review.
          </p>
        )}
      </div>
    </div>
  );
}
