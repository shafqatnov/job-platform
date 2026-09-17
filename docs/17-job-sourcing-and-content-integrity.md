# 17. Job Sourcing and Content Integrity

This document resolves a gap identified in the v1.0 architecture review: the blueprint never stated where job listings actually come from, which left duplicate-detection, moderation, and the platform's content-quality requirement unanchored.

## Sourcing model for launch

- **[CONFIRMED]** The sole job-sourcing model at launch is **direct, authorized employer self-service posting**. An employer creates an account, is tied to a company profile, and submits job listings themselves through the platform.
- **[CONFIRMED]** Third-party job aggregation, scraping, or bulk import from external job boards/APIs is explicitly **out of scope for launch**, regardless of technical feasibility, and must not be built as part of Phase 1 (see [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)).
- **[DEFERRED]** Aggregation/import from third-party sources as a *future* growth lever — only to be pursued post-launch, and only where the platform has a documented legal basis to do so (a licensing agreement, a partner feed with redistribution rights, or an API explicitly permitting it). "Technically able to fetch the data" is never sufficient justification on its own.

Choosing employer self-service as the only source for launch is what makes the content-integrity requirement tractable: every listing is first-party, consented, and attributable to an accountable party (the posting employer) from day one.

## Content-quality and provenance principle

- **[CONFIRMED]** The platform must never use AI (or any other technique) to rewrite, paraphrase, or otherwise disguise job content that originated from a source the platform is not authorized to redistribute. This applies both now (there is no such content, because there is no ingestion) and to any future aggregation phase.
- **[CONFIRMED]** If a future phase introduces any non-employer-submitted content, each listing must carry an explicit **source field** and, where the content is not the platform's own, a visible attribution/link back to the origin. AI use on such content (see [08-ai-architecture.md](08-ai-architecture.md)) is limited to structuring/enrichment (e.g. extracting fields), never to generating a rewritten description presented as original.
- **[RECOMMENDED]** Every job record — even under the employer-self-service-only model — carries a `source` field (e.g. `employer_direct`) from the first schema version, so that a future sourcing channel is additive (a new value in an existing field) rather than a retrofit.

## Duplicate detection (first implementation)

- **[CONFIRMED]** A basic duplicate-detection check runs at job-submission time, before a listing is published.
- **[RECOMMENDED]** First implementation: a normalized-match check on `(employer/company, job title, location)` — lowercase, whitespace-collapsed, punctuation-stripped comparison against the employer's other active listings, surfaced as a warning to the employer or a review flag for admin moderation rather than a hard block (a legitimate repost or multi-location listing shouldn't be silently rejected).
- **[DEFERRED]** Fuzzy/semantic duplicate detection (e.g. embedding similarity across the whole platform, not just one employer's listings) — a Phase 2+ enhancement once there's enough volume and an AI module (see [08](08-ai-architecture.md)) to build it on.

## Moderation / quality gate before publication

- **[CONFIRMED]** Every employer-submitted job passes through a quality gate before it is publicly visible. For launch, this is **manual admin review** (see [06-user-boundaries.md](06-user-boundaries.md) for the admin module's authority), not an automated system.
- **[RECOMMENDED]** Minimum content requirements enforced at submission (not just at review): a non-empty title, description, location, and company association. Listings failing these are rejected at the form level, before reaching a moderator.
- **[RECOMMENDED]** Admin moderation actions (approve, reject, request changes) are logged, consistent with the auditability principle in [11-security-principles.md](11-security-principles.md).
- **[DEFERRED]** Automated spam/fraud scoring — a Phase 2+ enhancement once there's enough labeled moderation history to justify it; manual review is sufficient at launch volume.

## Relationship to other documents

- Job lifecycle/expiry states are defined separately in [18-job-lifecycle.md](18-job-lifecycle.md).
- Schema-level implications of `source` and moderation `status` fields are reflected in [07-database-architecture.md](07-database-architecture.md).
