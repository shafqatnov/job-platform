# 3. Single Next.js Application Architecture

## Confirmed shape

- **[CONFIRMED]** One Next.js application (App Router), not a monorepo, not a set of microservices.
- **[CONFIRMED]** Future extraction of a piece of functionality into its own service must remain *possible* without a full rewrite — achieved through internal module boundaries, not through premature physical separation.

## Why a modular monolith

A single deployable app is simpler to build, test, deploy, and reason about while the team and traffic are small. The risk of a monolith is that boundaries erode over time until nothing can be separated later without a rewrite. The mitigation is discipline about internal structure now, while it's cheap.

## Logical layers (conceptual — not yet implemented)

1. **Presentation** — `app/` routes: server components for data-driven/SEO pages, client components only where interactivity is required.
2. **Domain modules** — business logic grouped by bounded context, e.g. (illustrative, not a mandate to create these directories today):
   - `jobs` — job posting, search, listing.
   - `candidates` — candidate profile and application logic.
   - `employers` — company and employer-account logic.
   - `admin` — moderation and platform-integrity logic.
   - `ai` — AI capability adapter (see [08](08-ai-architecture.md)).
   - `automation` — background/async task logic (see [09](09-automation-architecture.md)).
3. **Data access** — the only layer permitted to talk to the database directly (once one exists); invoked through each module's own service functions.
4. **Integration adapters** — AI providers, email/notification providers, future third-party APIs — each hidden behind an interface owned by the relevant domain module.

The `jobs` module additionally owns job-submission validation, duplicate-detection, moderation-gate, and lifecycle logic (see [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md), [18-job-lifecycle.md](18-job-lifecycle.md)) — these are business rules, not UI concerns, and belong in the module for the same testability reasons as the rest of this document. Authentication (see [19-authentication-strategy.md](19-authentication-strategy.md)) sits behind its own adapter, invoked by modules that need identity, rather than being reimplemented per module.

## Module boundary principle

- **[RECOMMENDED]** A module's internal data should only be read or written through that module's own exported functions — not by another module querying its tables/state directly. This is what makes later extraction (Phase 4, see [02](02-mvp-vs-future-phases.md)) a boundary change rather than a rewrite.
- **[RECOMMENDED]** UI components stay thin: data fetching and business rules live in modules, not in page/component files, so logic is testable independent of rendering.

## Explicit non-goals right now

- No separate backend service or BFF (Backend-for-Frontend).
- No GraphQL gateway or public API — see [24-api-and-mobile-readiness.md](24-api-and-mobile-readiness.md) for why the module boundary above still keeps this option open later.
- No monorepo tooling (Nx, Turborepo, workspaces) — a single `package.json` is sufficient at this size.

## Server vs. client components

- **[RECOMMENDED]** Default to server components, especially for public/SEO pages, for performance and crawlability. Reach for client components only where interactivity (forms, filters, dashboards) requires it.
