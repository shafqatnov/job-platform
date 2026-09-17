# 18. Job Lifecycle

This document resolves a gap identified in the v1.0 review: no document defined job states or expiry handling, despite this being central to both SEO health and user trust for a job board.

## States

- **[CONFIRMED]** Every job record has an explicit lifecycle status. Minimum required states for launch:
  - `pending_review` — submitted by an employer, awaiting moderation (see [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md)).
  - `active` — approved and publicly visible.
  - `expired` — past its expiry date; no longer publicly listed as open, but the page may still resolve (see "Handling expired pages" below).
  - `closed` — manually closed by the employer or admin before natural expiry (e.g. role filled).
  - `rejected` — failed moderation; not publicly visible, visible only to the submitting employer with a reason.

## Expiry fields and defaults

- **[CONFIRMED]** A job record carries a `postedAt`/`publishedAt` timestamp and an `expiresAt` date, set at publication time.
- **[RECOMMENDED]** Default listing duration of 30 days from publication, editable by the employer within a bounded range (e.g. 7–60 days) — exact bounds are a product-tuning detail, not fixed here.
- **[RECOMMENDED]** Employers can manually close or renew (re-extend the expiry of) an active listing before it expires.

## Automated expiry

- **[CONFIRMED]** Transitioning a job from `active` to `expired` when `expiresAt` passes is an automated background task, not a manual admin action — consistent with the automation principle in [09-automation-architecture.md](09-automation-architecture.md). The specific scheduler technology remains deferred there.

## Handling expired/closed pages (SEO implication)

- **[RECOMMENDED]** An expired or closed job's URL does not simply disappear or 404 silently. Options to choose from at implementation time (not decided here): show the listing marked clearly as "no longer accepting applications" with links to similar active jobs, or redirect to a relevant category/search page. The chosen behavior must avoid presenting a stale listing as currently open — that is a user-trust and AdSense/search-quality risk regardless of which specific option is picked.
- **[DEFERRED]** The exact expired-page UX and whether a hard redirect vs. a soft "closed" state is used — an implementation-time decision within the principle above.

## Relationship to other documents

- Moderation gate (`pending_review` → `active`/`rejected`) is defined in [17](17-job-sourcing-and-content-integrity.md).
- Schema representation of these states belongs in [07-database-architecture.md](07-database-architecture.md).
