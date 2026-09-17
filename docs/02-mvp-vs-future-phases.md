# 2. MVP Scope vs Future Phases

## Phase 0 — Current state

- Next.js scaffold, TypeScript, Tailwind CSS, ESLint configured.
- Git baseline established.
- This blueprint.
- No database, auth, AI, automation, or business logic implemented.

## Phase 1 — MVP

Goal: prove the core loop (candidate finds a job → applies; employer posts a job → reviews applicants) for a small number of countries, with SEO-crawlable public pages.

**In scope:**
- Public, SEO-indexed job listing and job detail pages.
- Public company profile pages.
- Candidate: create a basic profile, browse/search jobs, and apply — on-platform by default, or via an employer-specified external link, per the deliberate combination defined in [20-application-flow.md](20-application-flow.md).
- Employer: create a company, post a job (direct self-service only — see [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md)), view applicants for on-platform-application listings.
- Job lifecycle: `pending_review` → `active` → `expired`/`closed`, with automated expiry, per [18-job-lifecycle.md](18-job-lifecycle.md).
- Basic duplicate-detection check and manual admin moderation gate before any listing goes live, per [17](17-job-sourcing-and-content-integrity.md).
- Admin: basic moderation (approve/reject a listing, hide/remove a listing, disable a user).
- Authentication via a proven off-the-shelf solution (vendor deferred), per [19-authentication-strategy.md](19-authentication-strategy.md).
- Multi-country *structure* in the data model and URLs (country as a first-class dimension, path-based prefixes), even if only 1–2 countries have real content at launch. Minimal Phase 1 internationalization is exactly this country structure plus a single language per launch market — see the resolved scope in [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md). Translated, multi-language content within a country is not a Phase 1 feature.
- AdSense-ready foundations built into public page templates from the start (reserved ad slots, policy pages, consent mechanism) — see [21-adsense-readiness.md](21-adsense-readiness.md). AdSense approval/revenue itself is not assumed or required for launch.
- Basic analytics (traffic source, job-view-to-apply funnel) — see [23-analytics-and-measurement.md](23-analytics-and-measurement.md). This is a launch requirement, not an optional extra, since it's how the organic-SEO bet gets measured.
- A defined production-launch endpoint — see [25-launch-checklist.md](25-launch-checklist.md).

**Explicitly not in Phase 1 (deferred to later phases):**
- AI-assisted matching, ranking, or resume parsing — see [08-ai-architecture.md](08-ai-architecture.md).
- Third-party job aggregation/imports from external boards or APIs, even where technically feasible — only pursued post-launch and only with documented permission/licensing, per [17](17-job-sourcing-and-content-integrity.md).
- Automated notification/digest systems beyond the bare minimum (e.g. "application received" email may be considered minimal-viable, not automation infrastructure).
- Messaging/chat between candidates and employers.
- Payments, subscriptions, or paid/featured job promotion — direction recorded as deferred in [22-future-monetization.md](22-future-monetization.md).
- Advanced analytics/reporting dashboards (basic analytics is in scope; advanced BI is not — see [23](23-analytics-and-measurement.md)).
- Public API and native mobile apps — see [24-api-and-mobile-readiness.md](24-api-and-mobile-readiness.md).
- Full multi-language content translation and subdomain/ccTLD URL strategies — see [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md).
- Third-party integrations (ATS systems, job board syndication, calendar/scheduling tools).
- Programmatic/large-scale SEO content generation (e.g. auto-generated "jobs in every city" pages).
- Automated spam/fraud scoring and fuzzy/semantic duplicate detection — manual moderation and exact-match duplicate checks are sufficient for launch, per [17](17-job-sourcing-and-content-integrity.md).

## Phase 2 — AI-assisted features

- Resume parsing/structuring.
- Candidate-job matching/ranking suggestions.
- Job description quality suggestions for employers.
- Semantic/AI-assisted search.

Built behind the AI module boundary defined in [08-ai-architecture.md](08-ai-architecture.md), so Phase 1 code does not need to anticipate specific AI providers or models.

## Phase 3 — Automation & scale

- Background job/notification infrastructure (digests, reminders, moderation flags).
- Search infrastructure upgrade if job volume/query complexity outgrows the primary database (e.g. dedicated search index).
- Caching layer if read load requires it.

## Phase 4 — Extraction (conditional, not scheduled)

- Only if a specific module (e.g. AI matching, search) demonstrably needs independent scaling, deployment cadence, or team ownership, extract it into a separate service — enabled by the module boundaries established from Phase 1, not by a rewrite.

## Status of this phasing

- **[RECOMMENDED]** This phase breakdown and what belongs in each phase. Order and contents can shift as real user feedback arrives.
- **[CONFIRMED]** AI, automation, database, auth, payments, and other business logic are explicitly not to be implemented in the current step (per current project instructions) — only documented at the principle level.
- **[CONFIRMED]** The items in "Explicitly not in Phase 1" above are deliberately excluded from the launch checklist ([25-launch-checklist.md](25-launch-checklist.md)) — they are not missing, they are scoped out on purpose so the project has a real launch endpoint rather than growing indefinitely before shipping.
- **[DEFERRED]** Exact MVP country list, exact MVP feature cut line, and target launch date — business decisions outside this document's scope.
