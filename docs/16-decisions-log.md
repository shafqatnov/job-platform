# 16. Architecture Decisions Log

Consolidated view of every decision status across this blueprint (v1.1). See the linked document for full rationale on any row. This log reflects the outcome of the completed v1.0 architecture review — every review finding was either locked in as CONFIRMED, given a RECOMMENDED direction, or explicitly recorded as DEFERRED.

## Confirmed decisions

| # | Decision | Reference |
|---|---|---|
| 1 | Single Next.js application; no monorepo, no microservices now | [03](03-application-architecture.md) |
| 2 | Module/service boundaries must keep future extraction possible | [03](03-application-architecture.md) |
| 3 | Public SEO pages are structurally separate from authenticated dashboards; ads never appear on dashboards | [04](04-routing-and-url-strategy.md), [10](10-seo-architecture.md), [21](21-adsense-readiness.md) |
| 4 | Multi-country support designed into routing and data model from day one | [05](05-multi-country-architecture.md) |
| 5 | Candidate, employer, and admin have distinct, separated dashboard experiences | [06](06-user-boundaries.md) |
| 6 | Database is only ever accessed through a dedicated data-access layer, via module service functions | [07](07-database-architecture.md) |
| 7 | Job records carry `status`, `postedAt`/`expiresAt`, `source`, and `applicationMethod` fields from the first schema version | [07](07-database-architecture.md), [17](17-job-sourcing-and-content-integrity.md), [18](18-job-lifecycle.md), [20](20-application-flow.md) |
| 8 | AI capability is accessed only through a dedicated AI module/adapter, never coupled directly to UI code | [08](08-ai-architecture.md) |
| 9 | AI is never used to rewrite/paraphrase/disguise third-party job content as original | [08](08-ai-architecture.md), [17](17-job-sourcing-and-content-integrity.md) |
| 10 | Automation runs as decoupled background work, not inline in request/response code paths; job expiry is an automated task | [09](09-automation-architecture.md), [18](18-job-lifecycle.md) |
| 11 | Launch sourcing model is direct, authorized employer self-service posting only | [17](17-job-sourcing-and-content-integrity.md) |
| 12 | Third-party job aggregation/imports are excluded from launch, and require documented permission/licensing whenever pursued later | [17](17-job-sourcing-and-content-integrity.md) |
| 13 | Every employer-submitted job passes a basic duplicate-detection check and manual admin moderation before publication | [17](17-job-sourcing-and-content-integrity.md) |
| 14 | Job lifecycle states are `pending_review`, `active`, `expired`, `closed`, `rejected`, with automated expiry | [18](18-job-lifecycle.md) |
| 15 | Authentication uses a proven off-the-shelf solution, not a custom-rolled system | [11](11-security-principles.md), [19](19-authentication-strategy.md) |
| 16 | Phase 1 i18n scope is country-prefix routing + one language per market; multi-language-within-a-country is deferred | [02](02-mvp-vs-future-phases.md), [04](04-routing-and-url-strategy.md), [05](05-multi-country-architecture.md) |
| 17 | Job application flow is a deliberate combination: on-platform by default, employer-optional external URL per listing | [20](20-application-flow.md) |
| 18 | Monetization (ads or future employer plans) must never compromise the core job-search experience; ads are public-page-only | [21](21-adsense-readiness.md) |
| 19 | Privacy Policy, Terms of Service, About, and Contact pages, plus a consent mechanism, are launch requirements | [11](11-security-principles.md), [21](21-adsense-readiness.md), [25](25-launch-checklist.md) |
| 20 | AdSense approval and ad revenue are not assumed or guaranteed; the platform must function without them | [21](21-adsense-readiness.md) |
| 21 | Basic analytics (traffic source, view-to-apply funnel) is a launch requirement, not optional | [23](23-analytics-and-measurement.md) |
| 22 | No payment processing/billing/subscription logic exists in Phase 1 | [22](22-future-monetization.md) |
| 23 | No public API and no native mobile app exist in Phase 1; the web app must be responsive | [24](24-api-and-mobile-readiness.md) |
| 24 | The platform is not marketed as "AI-powered" at launch, since no AI ships in Phase 1 | [01](01-product-vision-and-scope.md) |
| 25 | Organic traffic is the intended channel but is not guaranteed; it is measured, not assumed | [01](01-product-vision-and-scope.md), [23](23-analytics-and-measurement.md) |
| 26 | Secrets/env vars are never committed to source control | [11](11-security-principles.md), [14](14-deployment-environment-strategy.md) |
| 27 | No tests exist yet in the current baseline (fact, not a plan) | [12](12-testing-strategy.md) |
| 28 | Current git state: one baseline commit on `master`, no remote | [13](13-git-branching-strategy.md) |
| 29 | Scale only when real usage data demands it; no premature infrastructure | [15](15-scalability-principles.md) |
| 30 | A concrete launch checklist exists so the project has a real production-launch endpoint | [25](25-launch-checklist.md) |

## Recommended (open, author's suggested direction)

| # | Recommendation | Reference |
|---|---|---|
| 1 | Path-based country URL prefixes (e.g. `/uk/jobs/...`) over subdomains/ccTLDs, for now | [04](04-routing-and-url-strategy.md) |
| 2 | Single shared database with country as a dimension, not database-per-country | [05](05-multi-country-architecture.md), [07](07-database-architecture.md) |
| 3 | Relational database (e.g. PostgreSQL) as the default data store choice | [07](07-database-architecture.md) |
| 4 | AI output treated as human-reviewed suggestion, not an automatic authoritative action | [08](08-ai-architecture.md) |
| 5 | Duplicate check at launch: exact normalized match on (employer, title, location); fuzzy/semantic matching deferred | [17](17-job-sourcing-and-content-integrity.md) |
| 6 | Default 30-day job listing duration, employer-editable within a bounded range | [18](18-job-lifecycle.md) |
| 7 | Email/password auth for all roles at minimum; social login optional, not required | [19](19-authentication-strategy.md) |
| 8 | External application clicks are tracked as events even though the application itself happens off-platform | [20](20-application-flow.md) |
| 9 | Ad slots reserved with fixed dimensions in sidebar/between-listings/below-content positions only | [21](21-adsense-readiness.md) |
| 10 | Privacy-conscious, cookie-light analytics tool preferred, sharing one consent system with ads | [21](21-adsense-readiness.md), [23](23-analytics-and-measurement.md) |
| 11 | Module service-layer functions are the seam a future API/mobile app would wrap, not reimplement | [03](03-application-architecture.md), [24](24-api-and-mobile-readiness.md) |
| 12 | Trunk-based git workflow with short-lived feature branches | [13](13-git-branching-strategy.md) |
| 13 | Rename default branch to `main` when a remote is added | [13](13-git-branching-strategy.md) |
| 14 | Vercel-style hosting (or equivalent) over custom infrastructure at MVP stage | [14](14-deployment-environment-strategy.md) |
| 15 | Single global deployment serving all countries | [14](14-deployment-environment-strategy.md) |
| 16 | Layered testing strategy (unit → integration → e2e) once features exist | [12](12-testing-strategy.md) |

## Deferred (explicitly not decided now)

| # | Deferred item | Reference |
|---|---|---|
| 1 | Full country-specific legal/compliance handling beyond baseline policy pages (e.g. deep GDPR review per new market) | [05](05-multi-country-architecture.md), [11](11-security-principles.md) |
| 2 | Database provider/hosting, ORM choice | [07](07-database-architecture.md) |
| 3 | Search infrastructure (Elasticsearch/Algolia) and caching layer (Redis) | [07](07-database-architecture.md), [15](15-scalability-principles.md) |
| 4 | AI provider/model selection, prompt management, vector store | [08](08-ai-architecture.md) |
| 5 | Queue/scheduler technology for automation | [09](09-automation-architecture.md) |
| 6 | Specific authentication vendor/library, MFA, SSO, passwordless flows | [19](19-authentication-strategy.md) |
| 7 | Git hosting provider/remote, PR review policy | [13](13-git-branching-strategy.md) |
| 8 | CI/CD tooling, monitoring/observability stack, hosting provider | [14](14-deployment-environment-strategy.md) |
| 9 | Multi-region/data-residency infrastructure | [15](15-scalability-principles.md) |
| 10 | Exact MVP country list, feature cut line, launch date | [02](02-mvp-vs-future-phases.md) |
| 11 | Employer multi-seat/team permissions model | [06](06-user-boundaries.md) |
| 12 | Programmatic/large-scale SEO content generation | [10](10-seo-architecture.md) |
| 13 | Third-party job aggregation/imports (only ever pursued with documented permission/licensing) | [17](17-job-sourcing-and-content-integrity.md) |
| 14 | Automated spam/fraud scoring, fuzzy/semantic duplicate detection | [17](17-job-sourcing-and-content-integrity.md) |
| 15 | Exact expired/closed job page UX (redirect vs. soft "closed" state) | [18](18-job-lifecycle.md) |
| 16 | Resume parsing/pre-fill at apply time, multi-stage applicant pipeline statuses, one-click apply | [20](20-application-flow.md) |
| 17 | AdSense account setup/approval process, ad density tuning, alternative ad networks | [21](21-adsense-readiness.md) |
| 18 | Paid/featured listings, employer subscription tiers, premium candidate features, all billing/payment logic | [22](22-future-monetization.md) |
| 19 | Advanced BI/dashboarding, cohort analysis, attribution modeling, A/B testing infrastructure, analytics vendor choice | [23](23-analytics-and-measurement.md) |
| 20 | Public API design/versioning, mobile app platform choice (native vs. PWA) | [24](24-api-and-mobile-readiness.md) |
