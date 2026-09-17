# 4. Route and URL Strategy

## Top-level split: public vs. authenticated

- **[CONFIRMED]** Public, SEO-facing routes (job listings, job detail, company pages, marketing/landing pages) are conceptually separate from authenticated dashboard routes (candidate dashboard, employer dashboard, admin), even though both live in the same Next.js app.
- **[RECOMMENDED]** Use Next.js route groups to express this separation physically once routes are built, e.g. a public group and a dashboard group, so layouts, auth requirements, and rendering strategy don't leak between them. Exact folder names are an implementation detail, not decided here.

## Multi-country URL shape

Three broad options, evaluated for a platform that is multi-country from day one but launching in only a few countries:

| Approach | Example | Pros | Cons |
|---|---|---|---|
| Path-based prefix | `example.com/uk/jobs/...` | Single domain, single deployment, SEO authority consolidates on one domain, simplest to implement and to add countries to later | Slightly less "local" feel than a ccTLD |
| Subdomain per country | `uk.example.com/jobs/...` | Clear separation, allows per-country infra later | More complex auth/session/cookie handling across subdomains; splits SEO authority; more operational overhead |
| Country-code TLD | `example.co.uk` | Strongest local trust/SEO signal | Requires owning and operating multiple domains/certs; highest overhead; hardest to start with |

- **[RECOMMENDED]** Start with path-based country prefixes (e.g. `/uk/...`, `/ae/...`). Lowest operational cost, keeps SEO authority unified, and doesn't block moving to subdomains or ccTLDs later if a specific market justifies it.
- **[DEFERRED]** Whether any specific future market warrants a subdomain or ccTLD — a business/marketing decision, not an engineering default.

### URL slug vs. internal ISO country code

- **[CONFIRMED]** The country path segment is a public-facing **URL slug**, not necessarily the country's raw ISO 3166-1 alpha-2 code. For most markets the slug and the ISO code are the same string (e.g. `ae`, `us`), but where the ISO code would be confusing or non-idiomatic as a URL, a distinct slug is used instead. The United Kingdom is the concrete example: its internal ISO code is `GB`, but its URL is `/uk/jobs`, matching common public convention rather than the ISO code.
- **[CONFIRMED]** The slug never changes the underlying country identity — `GB` remains the country's code for data/identity purposes; `uk` is only the public routing label. Route resolution must look up a country by this slug, not by assuming the URL segment equals the ISO code.
- The slug-to-country mapping lives in `src/constants/countries.ts` (`CountryOption.slug`), alongside the internal `code` field. See also [26-database-schema-design.md](26-database-schema-design.md) for the corresponding future database field.

## Slugs and canonical structure

- **[RECOMMENDED]** Jobs and companies get stable, human-readable, SEO-friendly slugs (e.g. `/uk/jobs/senior-backend-engineer-acme-corp`). Slugs should be treated as durable identifiers; a redirect strategy for renamed/removed listings is a Phase 1 SEO concern (see [10](10-seo-architecture.md)), not solved in this document.

## Admin and dashboard routes

- **[RECOMMENDED]** Admin routes live under a distinct, non-indexed path (e.g. `/admin/...`), excluded from sitemaps and disallowed in `robots.txt`, and gated by authorization — the specific auth mechanism is deferred (see [11-security-principles.md](11-security-principles.md)).

## Phase 1 internationalization scope (resolved)

The v1.0 review flagged an inconsistency: the MVP document claimed "structural i18n support" was in scope for Phase 1, while this document deferred locale handling entirely, with no actual structure defined. This is resolved as follows:

- **[CONFIRMED]** Phase 1's entire internationalization scope *is* the country-prefix routing already defined above (e.g. `/uk/...`, `/ae/...`), combined with **one language per launch market** (typically English, or the dominant business language for that market) — served under the existing country path with no separate locale URL segment.
- **[CONFIRMED]** Multiple languages *within* a single country (e.g. English and French both under `/uk/...`) is explicitly not a Phase 1 feature. This is what "translated content is not in Phase 1" in [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md) means in concrete routing terms.
- **[RECOMMENDED]** If a future phase adds multiple languages within one country, it is additive to the URL structure (e.g. an extra locale segment such as `/uk/fr/...`) rather than a redesign — the country-prefix scheme doesn't block this, it simply isn't built now.

## Deferred

- **[DEFERRED]** Exact route naming conventions and folder structure — to be decided when routes are actually implemented, not preemptively in this blueprint.
- **[DEFERRED]** Multi-language-within-a-country locale URL handling — see resolved Phase 1 scope above; this is a future addition, not an open ambiguity.
