# 26. Database Schema Design (Phase 1) — Planning Only

**Status:** Planning document. No database, ORM, or migration exists. This document describes entities, relationships, and constraints at a conceptual level to guide a future implementation — it contains no Prisma schema, no SQL, and no code.

This design implements the principles already established in [07-database-architecture.md](07-database-architecture.md) (relational model, module-aligned tables, data-access-layer-only access), and encodes the concrete decisions from [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md), [18-job-lifecycle.md](18-job-lifecycle.md), [19-authentication-strategy.md](19-authentication-strategy.md), [20-application-flow.md](20-application-flow.md), and [05-multi-country-architecture.md](05-multi-country-architecture.md) into an actual schema shape.

Tags follow the blueprint convention: **[CONFIRMED]**, **[RECOMMENDED]**, **[DEFERRED]**.

---

## 1. Entity List

Core entities for Phase 1:

| Entity | Purpose |
|---|---|
| `Country` | First-class market/jurisdiction dimension |
| `User` | Authenticated identity, shared by all roles |
| `CandidateProfile` | Candidate-specific data, one per candidate `User` |
| `Company` | Public employer/company profile |
| `EmployerProfile` | Employer-specific data, links a `User` to a `Company` |
| `Category` | Job classification (optionally hierarchical) |
| `Skill` | Normalized skill lookup |
| `JobSkill` | Job ↔ Skill join |
| `CandidateSkill` | Candidate ↔ Skill join *(recommended, see §10)* |
| `Job` | A job listing |
| `Application` | A candidate's on-platform application to a job |
| `ModerationAction` | Admin audit log for moderation/integrity actions |

- **[CONFIRMED]** This entity list matches the module boundaries in [03-application-architecture.md](03-application-architecture.md) (`jobs`, `candidates`, `employers`, `admin`) — each module owns the tables above that belong to it.
- **[DEFERRED]** Any entity related to AI (embeddings, match scores), automation (notification logs), monetization (plans, invoices), or a public API (API keys, tokens) — not created now; see §14–17.

---

## 2. Relationships

- `Country` 1—N `Job` (every job belongs to exactly one country)
- `Country` 1—N `CandidateProfile` (candidate's market)
- `Country` 1—N `Company` (optional: company's primary/registered country)
- `User` 1—0/1 `CandidateProfile` (present only when `User.role = candidate`)
- `User` 1—0/1 `EmployerProfile` (present only when `User.role = employer`)
- `User` (role = admin) 1—N `ModerationAction`
- `Company` 1—N `EmployerProfile` (one company can have multiple employer users — structurally supports future multi-seat, per [06-user-boundaries.md](06-user-boundaries.md), without building permission levels now)
- `Company` 1—N `Job`
- `Category` 1—N `Job` (a job has exactly one primary category in Phase 1)
- `Category` 1—N `Category` (optional self-referential parent/child hierarchy)
- `Job` N—M `Skill` via `JobSkill`
- `CandidateProfile` N—M `Skill` via `CandidateSkill` *(recommended)*
- `Job` 1—N `Application`
- `CandidateProfile` 1—N `Application`
- `Job` 0/1—0/1 `Job` (self-referential `duplicateOfJobId`, nullable — see §9)

```
Country ──< Company ──< EmployerProfile >── User
   │            │
   │            └──< Job >── Category
   │                  │  \
   ├──< CandidateProfile   >── JobSkill ──< Skill >── CandidateSkill ── CandidateProfile
   │        │                  │
   │        └──< Application >─┘
   │
   └──< Job (country scope)

User (admin) ──< ModerationAction
```

---

## 3. Primary Keys

- **[RECOMMENDED]** Every table uses a single surrogate primary key column (conventionally named `id`), not a natural/composite key — consistent with the module-boundary and future-extraction principles in [03](03-application-architecture.md) and [07](07-database-architecture.md).
- **[RECOMMENDED]** Publicly-referenced entities (`Job`, `Company`, `CandidateProfile` indirectly via applications) use a globally-unique identifier form (e.g. UUID) rather than a sequential integer, since sequential IDs on public job/company URLs invite enumeration and leak volume information; internal-only tables (`JobSkill`, `CandidateSkill`, `ModerationAction`) can use either form.
- **[DEFERRED]** The exact identifier type/generation strategy (UUID v4, UUID v7, ULID, or database-native sequential) — a database-provider-specific implementation detail, deferred along with the provider choice itself in [07](07-database-architecture.md).
- Note: the primary key is never the public-facing identifier for jobs/companies — that role belongs to the SEO slug (see [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md)), which is a separate, unique column.

---

## 4. Foreign Keys

| Table | Foreign key | References |
|---|---|---|
| `CandidateProfile` | `userId` | `User.id` (unique — enforces 1:1) |
| `CandidateProfile` | `countryId` | `Country.id` |
| `EmployerProfile` | `userId` | `User.id` (unique — enforces 1:1) |
| `EmployerProfile` | `companyId` | `Company.id` |
| `Company` | `countryId` (nullable) | `Country.id` |
| `Category` | `parentCategoryId` (nullable) | `Category.id` |
| `Job` | `companyId` | `Company.id` |
| `Job` | `countryId` | `Country.id` |
| `Job` | `categoryId` | `Category.id` |
| `Job` | `postedByUserId` | `User.id` (the employer user who submitted it) |
| `Job` | `duplicateOfJobId` (nullable) | `Job.id` (self-reference) |
| `JobSkill` | `jobId` | `Job.id` |
| `JobSkill` | `skillId` | `Skill.id` |
| `CandidateSkill` | `candidateProfileId` | `CandidateProfile.id` |
| `CandidateSkill` | `skillId` | `Skill.id` |
| `Application` | `jobId` | `Job.id` |
| `Application` | `candidateProfileId` | `CandidateProfile.id` |
| `ModerationAction` | `adminUserId` | `User.id` |
| `ModerationAction` | `targetJobId` (nullable) | `Job.id` |
| `ModerationAction` | `targetUserId` (nullable) | `User.id` |

- **[RECOMMENDED]** `ModerationAction` uses two nullable target foreign keys (job/user) rather than a single polymorphic `(targetType, targetId)` pair, since Phase 1 only moderates jobs and user accounts — this keeps referential integrity enforced by the database rather than by application code. Revisit if a third moderatable entity type is added later.

---

## 5. Required Indexes

- `Job(countryId, status)` — composite index for the primary public listing query ("active jobs in country X").
- `Job(status, expiresAt)` — supports the automated expiry task in [18-job-lifecycle.md](18-job-lifecycle.md) efficiently finding jobs whose `expiresAt` has passed.
- `Job(companyId)` — for a company's own job list and public company-profile pages.
- `Job(categoryId)` — for category-filtered browsing.
- `Job(slug)` — lookup by public URL slug (also see unique constraint, §6).
- `Application(jobId)` — employer's applicant list for a job.
- `Application(candidateProfileId)` — candidate's own application history.
- `JobSkill(skillId)` and `CandidateSkill(skillId)` — for skill-filtered search/matching.
- `ModerationAction(targetJobId)` / `ModerationAction(targetUserId)` — audit lookup by target.
- **[DEFERRED]** Full-text or trigram search indexes on `Job.title`/`Job.description` — acceptable to defer to a basic `LIKE`/database-native text search at launch volume; dedicated search infrastructure is explicitly deferred in [15-scalability-principles.md](15-scalability-principles.md).

---

## 6. Required Unique Constraints

- `User.email` — unique.
- `CandidateProfile.userId` — unique (enforces the 1:1 with `User`).
- `EmployerProfile.userId` — unique (enforces the 1:1 with `User`).
- `Company.slug` — unique.
- `Country.isoCode` — unique.
- `Country.urlSlug` — unique.
- `Skill.slug` — unique.
- `Category.slug` — unique.
- `Job(countryId, slug)` — **[RECOMMENDED]** unique per country rather than globally, matching the country-prefixed URL structure in [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md) (`/uk/jobs/<slug>` and `/ae/jobs/<slug>` may reuse a slug without collision).
- `JobSkill(jobId, skillId)` — unique pair (no duplicate tags).
- `CandidateSkill(candidateProfileId, skillId)` — unique pair.
- `Application(jobId, candidateProfileId)` — **[CONFIRMED]** unique pair — a candidate cannot submit more than one on-platform application to the same job.

---

## 7. Job Lifecycle

Implements [18-job-lifecycle.md](18-job-lifecycle.md) directly in the schema:

- `Job.status`: enumerated `pending_review | active | expired | closed | rejected`.
- `Job.postedAt` (nullable until approved), `Job.expiresAt`, `Job.closedAt` (nullable), `Job.rejectionReason` (nullable, set when `status = rejected`).
- **[CONFIRMED]** State transitions:
  - `pending_review → active` (admin approval, sets `postedAt` and computes `expiresAt`)
  - `pending_review → rejected` (admin rejection, sets `rejectionReason`)
  - `active → expired` (automated, when `expiresAt` passes — see [09-automation-architecture.md](09-automation-architecture.md))
  - `active → closed` (manual, by employer or admin, sets `closedAt`)
  - `active → active` (renewal — extends `expiresAt`, does not change status)
- **[RECOMMENDED]** No hard delete of `Job` rows through normal lifecycle transitions; a job leaves public visibility via status, not row deletion, preserving application history and audit trails (soft-delete principle from [07](07-database-architecture.md) applies here).

---

## 8. Country Strategy

Implements [05-multi-country-architecture.md](05-multi-country-architecture.md):

- `Country` is a standalone table: `id`, `isoCode` (e.g. `GB`, `AE`), `urlSlug` (the public routing segment, e.g. `uk` for `isoCode = GB` — see [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md)), `name`, `defaultCurrencyCode`, `defaultLocale` (Phase 1: one locale per country, per the resolved scope in [04](04-routing-and-url-strategy.md)), `isActive` (whether the market is live/rolled out).
- **[CONFIRMED]** `urlSlug` is a distinct field from `isoCode`, not derived from it — most countries' slug equals their lowercased ISO code, but this must not be assumed in code, since at least one supported market (the UK) has a slug that differs from its ISO code. Route resolution looks up `Country` by `urlSlug`, never by assuming the URL segment is the ISO code.
- **[CONFIRMED]** `Country` is referenced by foreign key from `Job` (required) and `CandidateProfile` (required); `Company` references it optionally (a company's primary market, distinct from the countries it posts jobs in).
- **[CONFIRMED]** Currency is stored as an explicit ISO code on `Job` (`currencyCode`) rather than inferred from `Country`, since salary currency and market country can diverge in principle, per [05](05-multi-country-architecture.md).
- **[DEFERRED]** A separate `Locale` table distinct from `Country` — not needed until a country ships more than one language.

---

## 9. Category Strategy

- `Category`: `id`, `name`, `slug`, `parentCategoryId` (nullable, self-referential).
- **[CONFIRMED]** A `Job` has exactly one required `categoryId` in Phase 1 (single-category classification) — multi-category tagging is unnecessary complexity at launch volume.
- **[RECOMMENDED]** The self-referential hierarchy (`parentCategoryId`) is included in the schema from Phase 1 even if the UI only surfaces top-level categories at first, so introducing sub-category browsing later (e.g. "Engineering" → "Backend Engineering") is additive, not a migration.
- **[DEFERRED]** Category-driven programmatic SEO pages (e.g. auto-generated per-category landing pages) — noted as a future SEO lever in [10-seo-architecture.md](10-seo-architecture.md), not built now.

---

## 10. Skills Strategy

- `Skill`: `id`, `name`, `slug` — a normalized, deduplicated lookup table (not free-text per job).
- `JobSkill`: join table tagging a job with zero or more skills.
- **[RECOMMENDED]** `CandidateSkill`: a parallel join table letting a candidate tag their basic profile with skills, even though [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md) only requires a "basic profile" for Phase 1. This is recommended, not confirmed, because it's a judgment call: the marginal schema cost is low, it directly enables skill-filtered candidate search/matching for employers, and — most importantly — it gives the Phase 2 AI-matching module (see [08-ai-architecture.md](08-ai-architecture.md)) clean structured input on day one instead of requiring retroactive resume-parsing just to backfill this data.
- **[DEFERRED]** Free-text skill extraction/parsing (e.g. from an uploaded resume) — a Phase 2 AI capability; Phase 1 skill tagging is manual, structured selection from the `Skill` lookup table only.

---

## 11. Employer Model

- `EmployerProfile`: `id`, `userId` (FK, unique), `companyId` (FK), `jobTitle` (their role at the company, optional), `createdAt`.
- **[CONFIRMED]** An employer is a `User` (role = `employer`) plus an `EmployerProfile` linking them to exactly one `Company`.
- **[CONFIRMED]** `Company.id` accepting multiple `EmployerProfile` rows means the schema already supports multiple team members per company without any permission-level system — per the deferred decision in [06-user-boundaries.md](06-user-boundaries.md), all employer users on a company have equal capability in Phase 1 (no owner/member distinction yet).
- **[DEFERRED]** Role/permission tiers within a company account (owner vs. member, billing-only access, etc.) — schema already leaves room via the 1—N shape above; no additional field is needed until this is prioritized.

---

## 12. Company Model

- `Company`: `id`, `name`, `slug` (unique), `description`, `websiteUrl`, `logoUrl`, `countryId` (nullable FK), `createdAt`, `updatedAt`.
- **[CONFIRMED]** `Company` is a distinct entity from `EmployerProfile`/`User`, since the company profile is public, SEO-indexed content (per [10-seo-architecture.md](10-seo-architecture.md), eligible for `Organization` structured data), while `User`/`EmployerProfile` are private account records.
- **[RECOMMENDED]** `Company.slug` uniqueness is global (not per-country), since a company profile page is a single canonical page regardless of how many countries it posts jobs in.
- **[DEFERRED]** Company verification/trust badges, multiple office locations per company, and any monetization-related field (see §16) — not part of Phase 1.

---

## 13. Candidate Model

- `CandidateProfile`: `id`, `userId` (FK, unique), `fullName`, `countryId` (FK), `city`/`locationText`, `headline` (optional), `resumeFileUrl` (optional), `createdAt`, `updatedAt`.
- **[CONFIRMED]** Kept intentionally minimal ("basic profile" per [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)) — no structured work-history/education tables in Phase 1.
- **[RECOMMENDED]** `CandidateSkill` (see §10) as the one piece of structured data beyond the basic fields, for the reasons given there.
- **[DEFERRED]** Structured work history, education, resume parsing into fields, portfolio links, visibility/privacy settings beyond the account itself — all Phase 2+ candidate-experience enhancements.

---

## 14. Future AI Compatibility

No AI-specific table or column exists in Phase 1. The schema is shaped so Phase 2 AI (see [08-ai-architecture.md](08-ai-architecture.md)) can be added without restructuring existing tables:

- **[RECOMMENDED]** Structured `Job` fields (category, skills, salary range, employment type) and `CandidateSkill` are populated from Phase 1 onward specifically so a future matching/ranking model has clean structured input, rather than depending on AI to first extract structure from unstructured text.
- **[RECOMMENDED]** Any future AI output (e.g. a match score, an embedding vector) is added as new, nullable columns or entirely new tables (`JobEmbedding`, `CandidateEmbedding`, `MatchScore`) that reference the existing `Job`/`CandidateProfile` primary keys — additive, not a modification of existing columns.
- **[DEFERRED]** Whether embeddings live in the primary relational database (e.g. a vector extension) or a separate vector store — an infrastructure choice deferred in [08](08-ai-architecture.md) and [07](07-database-architecture.md), irrelevant to the Phase 1 schema itself.
- **[CONFIRMED]** No column or table implies that AI-generated content replaces employer-submitted content — consistent with the content-integrity guardrail in [08](08-ai-architecture.md) and [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md).

---

## 15. Future Automation Compatibility

- **[CONFIRMED]** The `Job.status`/`expiresAt` fields (§7) are what the automated expiry worker (see [09-automation-architecture.md](09-automation-architecture.md)) operates on — no additional schema is needed to support that specific task at launch.
- **[RECOMMENDED]** Future automation needs (scheduled digest emails, reminder notifications) are expected to add their own new tables (e.g. a `NotificationLog`) referencing existing entities by foreign key, rather than adding automation-specific columns onto `User`/`Job`/`Application`.
- **[DEFERRED]** Any notification/digest/queue-tracking table — not created now; no automation is implemented in Phase 1 per [09](09-automation-architecture.md).

---

## 16. Future Monetization Compatibility

- **[CONFIRMED]** No billing, payment, plan, or subscription table exists in Phase 1, consistent with [22-future-monetization.md](22-future-monetization.md).
- **[RECOMMENDED]** If/when employer monetization is built, it is expected to add nullable fields such as `Company.planTier` or `Job.featuredUntil` — additive columns, not a redesign of `Company` or `Job`. This document does not add those columns now; it only notes that doing so later does not require restructuring the entities defined above.
- **[DEFERRED]** Any concept of a paid plan, invoice, payment method, or featured-listing flag — genuinely not modeled until monetization is prioritized, per [22](22-future-monetization.md).

---

## 17. Future API Compatibility

- **[CONFIRMED]** No public API exists in Phase 1, per [24-api-and-mobile-readiness.md](24-api-and-mobile-readiness.md).
- **[RECOMMENDED]** Using ISO-standard codes for country (`isoCode`) and currency (`currencyCode`) from Phase 1 (§8) makes any future API/partner integration interoperable without a translation layer.
- **[RECOMMENDED]** Surrogate primary keys and stable slugs (§3, §6) are what a future API would expose as resource identifiers — no separate "public ID" scheme needs to be retrofitted later.
- **[DEFERRED]** API-specific concerns — API keys/tokens, rate-limit tracking, webhook subscriptions — no such tables are created now; they would be introduced only alongside an actual future API effort, per [24](24-api-and-mobile-readiness.md).

---

## Summary: what this document does and does not do

- Does: define entities, relationships, keys, indexes, and constraints at a conceptual level, and show how each Phase 1 table choice remains compatible with deferred future work (AI, automation, monetization, API).
- Does not: choose a database provider or ORM (deferred in [07](07-database-architecture.md)), write a Prisma schema, write SQL DDL, or create any migration or implementation file.
