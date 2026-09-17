# 20. Job Application Flow

The v1.0 review flagged that "a candidate applies to a job" was ambiguous — it didn't say whether applications happen on-platform, via an external link, or some combination. This document resolves it.

## Decision

- **[CONFIRMED]** Phase 1 uses a **deliberate limited combination**:
  1. **On-platform application is the default.** A candidate applies using their platform profile (plus an optional note/cover message), and the application is stored as a record the employer reviews in their dashboard (see [06-user-boundaries.md](06-user-boundaries.md)).
  2. **An employer may optionally specify an external application URL** for a given job instead of accepting on-platform applications (e.g. because they use their own applicant tracking system). When set, the platform's "Apply" action for that listing links out to that URL rather than opening the on-platform application form.

This combination was chosen deliberately: forcing every employer onto a single exact flow adds friction without adding value (some already have their own ATS), while defaulting to on-platform applications is what makes an employer dashboard with real applicant data meaningful for the majority of listings, and is more defensible for the platform's content/trust positioning than a pure link-out model.

## What this implies

- **[RECOMMENDED]** The job record carries an explicit `applicationMethod` (`on_platform` or `external_url`) set at posting time, with the external URL stored if applicable. This is a schema-level implication for [07-database-architecture.md](07-database-architecture.md).
- **[RECOMMENDED]** External application links are still tracked at the point of click (an outbound-click event) so application-flow analytics (see [23-analytics-and-measurement.md](23-analytics-and-measurement.md)) remain meaningful even when the application itself happens off-platform.

## Deferred

- **[DEFERRED]** Resume parsing or pre-filling at the point of on-platform application — a Phase 2 AI-adjacent enhancement (see [08-ai-architecture.md](08-ai-architecture.md)), not required for launch.
- **[DEFERRED]** Multi-stage applicant pipeline statuses beyond "received" (e.g. shortlisted, interviewing, rejected) — a later employer-tooling enhancement, not a launch requirement.
- **[DEFERRED]** One-click/quick-apply mechanisms — a UX optimization for later, once there's usage data to justify prioritizing it.
