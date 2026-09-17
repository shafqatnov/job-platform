# Folder Structure — src/

This document describes the approved `src/` folder architecture for the single Next.js modular monolith, implementing the module-boundary principles already established in [../03-application-architecture.md](../03-application-architecture.md), [../06-user-boundaries.md](../06-user-boundaries.md), [../08-ai-architecture.md](../08-ai-architecture.md), and [../09-automation-architecture.md](../09-automation-architecture.md).

The folders exist now, as an empty skeleton, so that as features are built there is already an agreed place for each kind of code — not because any of this logic is implemented yet. **No business logic, database access, authentication, AI, or automation exists in this project as of this document.**

## Directory-by-directory

### `src/app/`

**Purpose:** Next.js App Router routes — pages, layouts, route handlers.

**Belongs here:** Route files (`page.tsx`, `layout.tsx`, `route.ts`), route-level loading/error boundaries, and route grouping (e.g. a future public-vs-dashboard split per [../04-routing-and-url-strategy.md](../04-routing-and-url-strategy.md)).

**Must not belong here:** Business rules, data-access code, or anything reusable outside a specific route. A page component should call into `features/` or `services/`, not implement logic inline.

### `src/components/`

**Purpose:** Shared, reusable, presentation-only UI components used across more than one feature or route (buttons, form inputs, layout primitives, cards).

**Belongs here:** Components with no knowledge of a specific business domain — they take props and render.

**Must not belong here:** Components that fetch data, call services, or encode business rules specific to jobs/candidates/employers. A component that is only ever used by one feature belongs inside that feature's own folder in `features/`, not here.

### `src/features/`

**Purpose:** Domain/feature modules — the primary expression of the module boundaries in [../03-application-architecture.md](../03-application-architecture.md) (e.g. a future `features/jobs/`, `features/candidates/`, `features/employers/`, `features/admin/`).

**Belongs here:** UI and orchestration specific to one domain: feature-specific components, the calls into that domain's `services/` functions, feature-specific hooks and types. Each feature folder is expected to expose a small, deliberate public surface (what other code is allowed to import) rather than letting other features reach into its internals.

**Must not belong here:** Direct database/ORM calls (that's `services/`/`lib/`), and logic that belongs to a *different* domain. A jobs feature must not read or write candidate data directly — see "Dependency direction" and "UI must not access the database" below.

### `src/lib/`

**Purpose:** Low-level, technical infrastructure code shared across the app — the data-access layer, external client setup, and other framework/technical concerns that aren't tied to one business domain.

**Belongs here:** Database client setup (once a database exists), the data-access layer described in [../07-database-architecture.md](../07-database-architecture.md), generic infrastructure helpers.

**Must not belong here:** Domain-specific business rules (that's `services/` or `features/`), and UI code.

### `src/services/`

**Purpose:** Domain service functions — the "module's own exported functions" through which a feature's data and business rules are accessed, per [../03-application-architecture.md](../03-application-architecture.md) and [../07-database-architecture.md](../07-database-architecture.md).

**Belongs here:** Functions like "get active jobs for a country," "submit a job for moderation," "record an application" — the business-rule layer that `features/` UI calls into, and the only layer permitted to talk to `lib/`'s data-access code.

**Must not belong here:** JSX/UI code, and direct SQL/ORM calls (those live in `lib/`; services orchestrate, the data-access layer executes).

### `src/hooks/`

**Purpose:** Shared React hooks with no business-domain knowledge (e.g. a generic `useDebounce`, `useMediaQuery`).

**Belongs here:** Reusable, generic React state/effect logic.

**Must not belong here:** Hooks that encode business rules for one domain — those belong inside that feature's folder in `features/`.

### `src/providers/`

**Purpose:** React context providers and app-wide wiring (e.g. a future theme provider, a future auth-session provider).

**Belongs here:** Provider components and their context definitions.

**Must not belong here:** Business logic — a provider supplies context, it doesn't implement domain rules.

### `src/utils/`

**Purpose:** Small, pure, generic helper functions with no framework or domain dependency (string/date/number formatting, simple transforms).

**Belongs here:** Stateless pure functions usable from anywhere.

**Must not belong here:** Anything that calls a service, touches data, or is specific to one domain.

### `src/types/`

**Purpose:** Shared TypeScript types/interfaces used across more than one feature or layer (e.g. a `Country` or `Money` type used by both jobs and candidates).

**Belongs here:** Cross-cutting type definitions.

**Must not belong here:** Types used by only one feature — keep those colocated inside that feature's folder in `features/`.

### `src/config/`

**Purpose:** Application configuration values (e.g. supported countries list, feature flags, environment-derived constants read once at startup).

**Belongs here:** Configuration reading/shaping code.

**Must not belong here:** Secrets (per [../11-security-principles.md](../11-security-principles.md), secrets stay in environment variables, never committed or hardcoded here), and business logic.

### `src/constants/`

**Purpose:** Fixed, literal values shared across the app (route path segments, enum-like string literals, limits).

**Belongs here:** `const` values with no logic attached.

**Must not belong here:** Anything that computes a value at runtime — that's `config/` or `utils/`.

### `src/validation/`

**Purpose:** Input validation schemas/rules (e.g. validating a job-submission form or an application payload), shared between client-side form checks and server-side enforcement.

**Belongs here:** Validation schema definitions and pure validation functions.

**Must not belong here:** Authorization checks ("is this user allowed to do this") — that is a security/service-layer concern per [../11-security-principles.md](../11-security-principles.md) and [../06-user-boundaries.md](../06-user-boundaries.md), not input validation.

### `src/styles/`

**Purpose:** Global/shared styling assets beyond component-local styles (e.g. shared Tailwind layer definitions, design tokens).

**Belongs here:** Global CSS and shared style configuration. `src/app/globals.css` remains in place; this folder is for additional shared style assets as they're introduced.

**Must not belong here:** Component markup or logic.

---

## Dependency direction

Dependencies flow in one direction only:

```
app/  →  features/  →  services/  →  lib/
              ↓             ↓
        components/    (data access, external clients)
        hooks/
        types/
        utils/
        validation/
        constants/
        config/
        providers/
```

- `app/` may depend on `features/`, `components/`, `providers/`, and the shared leaf folders (`hooks/`, `types/`, `utils/`, `config/`, `constants/`, `validation/`).
- `features/` may depend on `services/`, `components/`, and the shared leaf folders. A feature must not import another feature's internals directly — only what that feature deliberately exposes.
- `services/` may depend on `lib/` and the shared leaf folders. `services/` must never import from `app/`, `features/`, or `components/` — the direction never reverses.
- `lib/` depends on nothing above it. It is the lowest layer.
- `components/`, `hooks/`, `utils/`, `types/`, `constants/`, `config/`, `validation/`, `providers/` are shared leaves: they may depend on each other where sensible (e.g. a component using a util) but must never depend on `features/` or `services/` — that would invert the dependency direction and couple generic code to one domain.

This ordering is what preserves the future-extraction option described in [../03-application-architecture.md](../03-application-architecture.md) and [../15-scalability-principles.md](../15-scalability-principles.md): a `features/` + `services/` pair can be lifted into a separate service later precisely because nothing below it depends on anything above it.

## UI must not directly access the database

- **[CONFIRMED]** No component, hook, or file under `app/`, `components/`, `features/`, `hooks/`, or `providers/` may import a database client or query builder directly. All data access goes through `services/`, which in turn is the only caller of the data-access code in `lib/` — per the access-pattern principle in [../07-database-architecture.md](../07-database-architecture.md).
- This is enforced by convention and code review today (no database exists yet to enforce it against); once a database is introduced, the database client itself should live only in `lib/`, never be imported from `app/`, `components/`, or `features/`.

## AI and automation remain isolated from UI

- **[CONFIRMED]** When AI capability is introduced (Phase 2, [../08-ai-architecture.md](../08-ai-architecture.md)), it is accessed only through a dedicated AI adapter reached via `services/` (e.g. a `services/ai/` boundary) — never called directly from `app/`, `components/`, or `features/` UI code.
- **[CONFIRMED]** When automation/background-job capability is introduced ([../09-automation-architecture.md](../09-automation-architecture.md)), its logic lives behind `services/` in the same way, and any scheduler/queue wiring belongs in `lib/`, not in UI code paths.
- The practical rule: if a file under `app/`, `components/`, `features/`, `hooks/`, or `providers/` needs an AI or automation capability, it calls a function exported from `services/` — it never imports an AI SDK, prompt, model client, or job-queue client itself.

## Guidance for future candidate/employer/admin modules

Per [../06-user-boundaries.md](../06-user-boundaries.md), candidate, employer, and admin are separate boundaries. When those modules are built:

- Each becomes its own folder under `features/` (e.g. `features/candidates/`, `features/employers/`, `features/admin/`), plus a matching folder under `services/` (e.g. `services/candidates/`, `services/employers/`, `services/admin/`).
- A feature module owns its own data access path through its own `services/` folder. **One feature must not import another feature's `services/` internals directly** — e.g. `features/employers/` must not reach into `services/candidates/`'s internal functions to read a candidate profile. If the employer feature legitimately needs candidate data (e.g. viewing an applicant's profile on an application), it calls a function the candidates service module deliberately exposes for that purpose, not an internal implementation detail.
- Admin is not a shortcut around this boundary: `features/admin/` and `services/admin/` implement their own explicit, scoped actions (e.g. "hide a job," "suspend a user") rather than admin code reaching directly into other domains' internals, per the admin principle in [../06-user-boundaries.md](../06-user-boundaries.md) and [../11-security-principles.md](../11-security-principles.md).
- Public, unauthenticated routes (SEO job/company pages) are expected to live under `app/` route groups that call into `features/jobs/` and `features/employers/` (for public company profiles) using only their public read paths — they do not route through candidate/admin features at all.

## What this document does not do

- It does not create any file inside these folders. They are intentionally empty at this stage.
- It does not implement authentication, database access, AI, automation, or any business logic.
- It does not mandate exact file-naming conventions within each folder — those can be decided when the first real feature is implemented.
