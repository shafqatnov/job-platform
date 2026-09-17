# 24. Future API and Mobile Readiness (Deferred)

No public API and no mobile app are built as part of this blueprint or its launch scope. This document records forward-compatible principles only, so a future addition doesn't require re-deriving business logic that already exists in the web app.

## Principle

- **[RECOMMENDED]** The domain-module service functions described in [03-application-architecture.md](03-application-architecture.md) (jobs, candidates, employers, admin) are the natural seam for a future API: a REST/GraphQL layer, if built later, should be a thin wrapper calling those same module functions — not a parallel reimplementation of business rules (validation, moderation, lifecycle transitions) that already live in the modules.
- **[RECOMMENDED]** A future mobile app (native or a PWA-style approach — not decided) would consume the same module/API layer as the web app, for the same reason: business logic lives once, in the modules, regardless of how many front ends eventually call it.

## Explicitly not built now

- **[CONFIRMED]** No public/partner-facing API exists in Phase 1.
- **[CONFIRMED]** No native mobile app exists in Phase 1; the web app must be responsive/usable on mobile browsers (a UI requirement, not a separate app).

## Deferred

- **[DEFERRED]** API design, versioning, authentication-for-third-parties, and rate limiting — all real design work to happen only once an actual API consumer (e.g. a mobile app, or a partner integration) is being built.
- **[DEFERRED]** Mobile app platform choice (native iOS/Android vs. a cross-platform/PWA approach) — a decision for whenever mobile is actually prioritized, informed by usage data on how candidates currently access the site.
