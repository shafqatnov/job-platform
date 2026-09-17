# Project Blueprint v1.1 — Global AI-Powered Job Platform

**Status:** Draft v1.1
**Date:** 2026-09-17
**Scope:** Documentation only. Nothing in this directory changes application behavior, dependencies, or configuration.

## Purpose

This blueprint captures the architecture direction for the job platform before feature work begins. It exists so that early decisions (routing shape, multi-country model, module boundaries, AI/automation placement, job sourcing, monetization posture) are made deliberately once, instead of accreting ad hoc as features are built.

## How to read this

Every meaningful architectural statement in these documents is tagged with one of:

- **[CONFIRMED]** — Decided. Stated explicitly by the project owner or directly implied by an explicit instruction. Should not be re-litigated without a reason.
- **[RECOMMENDED]** — Not yet decided by the owner. This is the author's suggested direction and rationale, open to change.
- **[DEFERRED]** — Explicitly not being decided now. Listed so it isn't forgotten, not so it gets solved prematurely.

## What changed in v1.1

v1.1 is a direct response to a completed architecture review of v1.0 (see the review findings summarized in [16-decisions-log.md](16-decisions-log.md)). It closes gaps and resolves inconsistencies found in that review, without changing the v1.0 decisions that held up. Notably:

- Added job sourcing, content-integrity, lifecycle, moderation, and duplicate-detection principles ([17](17-job-sourcing-and-content-integrity.md), [18](18-job-lifecycle.md)) — entirely absent from v1.0.
- Gave authentication an explicit direction instead of leaving it fully open ([19](19-authentication-strategy.md)).
- Resolved the ambiguity around how candidates apply to jobs ([20](20-application-flow.md)).
- Added AdSense-readiness, future monetization, analytics, and API/mobile-readiness principles ([21](21-adsense-readiness.md), [22](22-future-monetization.md), [23](23-analytics-and-measurement.md), [24](24-api-and-mobile-readiness.md)) — none of which existed in v1.0.
- Added a concrete launch checklist ([25](25-launch-checklist.md)) so the project has a real production-launch endpoint.
- Resolved an internal inconsistency between the MVP document and the routing document over Phase 1 internationalization scope ([02](02-mvp-vs-future-phases.md), [04](04-routing-and-url-strategy.md)).
- Resolved a positioning contradiction: the platform is no longer described as "AI-powered" at launch, since no AI ships in Phase 1 ([01](01-product-vision-and-scope.md)).
- Cross-referenced the above into the previously existing documents (application architecture, database, AI, automation, SEO, security, user boundaries) so the full set is internally consistent.

## Contents

1. [Product Vision and Scope](01-product-vision-and-scope.md)
2. [MVP Scope vs Future Phases](02-mvp-vs-future-phases.md)
3. [Single Next.js Application Architecture](03-application-architecture.md)
4. [Route and URL Strategy](04-routing-and-url-strategy.md)
5. [Multi-Country Architecture](05-multi-country-architecture.md)
6. [Candidate, Employer, and Admin Boundaries](06-user-boundaries.md)
7. [Database Architecture Principles](07-database-architecture.md)
8. [AI Architecture Principles](08-ai-architecture.md)
9. [Automation Architecture Principles](09-automation-architecture.md)
10. [SEO Architecture Principles](10-seo-architecture.md)
11. [Security Principles](11-security-principles.md)
12. [Testing Strategy](12-testing-strategy.md)
13. [Git and Branching Strategy](13-git-branching-strategy.md)
14. [Deployment / Environment Strategy](14-deployment-environment-strategy.md)
15. [Scalability Principles](15-scalability-principles.md)
16. [Decisions Log](16-decisions-log.md) — consolidated table of every CONFIRMED / RECOMMENDED / DEFERRED item across this blueprint
17. [Job Sourcing and Content Integrity](17-job-sourcing-and-content-integrity.md) — *new in v1.1*
18. [Job Lifecycle](18-job-lifecycle.md) — *new in v1.1*
19. [Authentication Strategy](19-authentication-strategy.md) — *new in v1.1*
20. [Job Application Flow](20-application-flow.md) — *new in v1.1*
21. [AdSense Readiness](21-adsense-readiness.md) — *new in v1.1*
22. [Future Employer Monetization (Deferred)](22-future-monetization.md) — *new in v1.1*
23. [Analytics and Traffic Measurement](23-analytics-and-measurement.md) — *new in v1.1*
24. [Future API and Mobile Readiness (Deferred)](24-api-and-mobile-readiness.md) — *new in v1.1*
25. [Launch Checklist](25-launch-checklist.md) — *new in v1.1*
26. [Database Schema Design (Phase 1, Planning Only)](26-database-schema-design.md)

## Baseline at time of writing

- Framework: Next.js 16.3.5 (App Router), React 19.2.8, TypeScript 5 (strict), Tailwind CSS 4.
- Git: single repository, one baseline commit (`chore: initialize job platform`), no remote configured.
- No database, no auth, no AI integration, no automation, and no business logic exist yet — this blueprint is written against a clean scaffold.
