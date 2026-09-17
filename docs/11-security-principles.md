# 11. Security Principles

No authentication, authorization, or data storage exists yet. This document states principles for when those are implemented.

## Access boundaries

- **[CONFIRMED]** Candidate, employer, and admin boundaries (see [06-user-boundaries.md](06-user-boundaries.md)) are enforced with least-privilege access — each role can only act within its own scope, and admin capability is modeled as explicit, scoped actions rather than blanket access.
- **[RECOMMENDED]** Authorization checks are centralized and invoked by domain modules, not duplicated inline across UI components, so the real access-control logic lives in one auditable place.

## Authentication

- **[CONFIRMED]** A proven, off-the-shelf authentication solution is used rather than a custom-rolled auth system — session/credential handling is a well-known source of security defects when built from scratch. Full direction in [19-authentication-strategy.md](19-authentication-strategy.md).
- **[DEFERRED]** Specific auth provider/vendor (e.g. managed auth service vs. self-hosted, session vs. token-based) — see [19](19-authentication-strategy.md).

## Data protection

- **[RECOMMENDED]** Personally identifiable information (candidate contact details, resumes) is access-controlled by role and encrypted at rest once a database exists.
- **[CONFIRMED]** Secrets and credentials are never committed to git — `.env*` is already excluded via `.gitignore` in the current baseline. A dedicated secrets manager is a future production concern, not needed at this stage.
- **[RECOMMENDED]** All module boundaries validate their inputs; client-supplied data is never trusted for authorization decisions (e.g. a request should never be able to assert "I am an admin" — that must be derived server-side from an authenticated session).

## Compliance

- **[CONFIRMED]** Baseline legal/policy pages (Privacy Policy, Terms of Service, About, Contact) and a cookie/consent mechanism are launch requirements for the initial launch market(s), not deferred — see [21-adsense-readiness.md](21-adsense-readiness.md) and [25-launch-checklist.md](25-launch-checklist.md). This is distinct from the item below.
- **[DEFERRED]** Full country-specific privacy/data-protection law review (e.g. GDPR depth, beyond baseline policy pages) for markets added *after* the initial launch — requires legal review per country as each is added, not an engineering default set here (see [05-multi-country-architecture.md](05-multi-country-architecture.md)).

## Auditability

- **[RECOMMENDED]** Admin actions (moderation, account suspension, etc.) are logged with enough detail to answer "who did what, when" — implementation deferred until the admin module itself is built.
