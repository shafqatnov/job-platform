# 5. Multi-Country Architecture

## Confirmed principle

- **[CONFIRMED]** Multi-country support is designed into the architecture from day one — the data model and routing must not assume a single country — even though real content may launch in only one or two countries initially.

## Data model implications (principles only — no schema implemented yet)

- `Country` is a first-class concept, not a free-text field bolted on later. Jobs, companies, and applications are associated with a country.
- **Country** (market/legal jurisdiction) and **locale** (language) are modeled as separate concerns, since a single country can have multiple languages and the platform may later serve one language across multiple countries.
- Currency is stored as an explicit code alongside any monetary amount (e.g. salary), never assumed from country alone, and formatted per-locale at display time.

## SEO implications

- Per-country sitemaps, so search engines can crawl and index each market's listings independently.
- `hreflang` annotations once more than one country/locale combination exists, to avoid duplicate-content penalties and to serve the right market's page in search results.
- Canonicalization rules for any content that is shared or near-duplicate across countries.

(Full SEO principles in [10-seo-architecture.md](10-seo-architecture.md).)

## Legal and compliance variance

- **[DEFERRED]** Country-specific labor law, data protection law (e.g. GDPR in the EU), and employment-posting regulations. These vary by market and require legal review per country before that country is fully launched — not an engineering default this blueprint can set.
- **[RECOMMENDED]** The architecture should not make future per-country compliance handling (e.g. data residency, consent flows) structurally harder — e.g. by keeping country as an explicit, queryable dimension rather than implicit in unrelated fields.

## Database strategy for multi-country data

- **[RECOMMENDED]** Start with a single shared database where country is a dimension (a column/relation), not a database-per-country or schema-per-country split. This is simpler to operate and query across countries (e.g. for admin/global reporting) while the platform is small.
- **[DEFERRED]** Sharding or physically separating data by country/region — only justified by real data residency requirements or real scale, neither of which exists yet.

## Phase 1 locale scope

- **[CONFIRMED]** Country and locale are modeled as separate concerns (above), but Phase 1 only exercises the country dimension. Each launch market ships in a single language; multi-language content within one country is deferred. The concrete URL implication of this is resolved in [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md).

## Rollout model

- **[RECOMMENDED]** New countries are enabled by adding data (country records, translated/localized static content) and, where needed, legal review — not by code changes to the routing or data model, since both already account for multiple countries.
