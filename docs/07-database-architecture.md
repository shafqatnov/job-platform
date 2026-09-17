# 7. Database Architecture Principles

No database exists in this project yet. This document states principles to guide a future implementation — it does not implement, choose a provider for, or configure one.

## Data shape principles

- **[RECOMMENDED]** A relational database (e.g. PostgreSQL) fits this domain well: jobs, companies, candidates, and applications are structured entities with clear relationships (a job belongs to a company; an application links a candidate and a job).
- **[RECOMMENDED]** Country is modeled as a first-class relation/dimension on relevant entities (see [05-multi-country-architecture.md](05-multi-country-architecture.md)), not inferred from unrelated fields.
- **[RECOMMENDED]** Tables/entities are organized along the same domain-module boundaries used in the application code (jobs, candidates, employers, admin) so the data layer and the module layer reinforce the same seams — useful if a module is ever extracted (see [03](03-application-architecture.md)).
- **[RECOMMENDED]** Soft deletes and audit timestamps (created/updated/deleted-at) on records that matter for compliance or dispute resolution (job postings, applications, admin actions).
- **[CONFIRMED]** A job record includes, from the first schema version: a lifecycle `status` (`pending_review` / `active` / `expired` / `closed` / `rejected`), `postedAt`/`expiresAt` timestamps, a `source` field (`employer_direct` at launch), and an `applicationMethod` (`on_platform` / `external_url`, with the URL if applicable). Full rationale in [18-job-lifecycle.md](18-job-lifecycle.md), [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md), and [20-application-flow.md](20-application-flow.md) respectively — these are schema-shaping decisions made now precisely so they aren't retrofitted after real data exists.

## Access pattern principle

- **[CONFIRMED]** The database is only ever accessed through a dedicated data-access layer, invoked by each domain module's own service functions — never queried directly from UI/page code. This is what keeps modules independently testable and independently extractable later.

## Migrations

- **[RECOMMENDED]** Schema changes are version-controlled migrations from the first schema onward, not manual/ad hoc changes to a live database, even in development.

## Explicitly deferred

- **[DEFERRED]** Choice of database provider/hosting (self-managed Postgres, managed service, serverless Postgres, etc.).
- **[DEFERRED]** Choice of ORM or query builder.
- **[DEFERRED]** Read replicas, connection pooling strategy, and any sharding/partitioning approach.
- **[DEFERRED]** Dedicated search infrastructure (e.g. Elasticsearch/Algolia) for job search — the primary database is assumed sufficient for search until real query volume/complexity proves otherwise (see [15-scalability-principles.md](15-scalability-principles.md)).
- **[DEFERRED]** Caching layer (e.g. Redis) — not justified before real read-load data exists.
