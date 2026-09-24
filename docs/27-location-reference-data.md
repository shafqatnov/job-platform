# 27. Location Reference Data

## Existing data (Country, City) — provenance undocumented

The `Country` table (249 rows, essentially the full ISO 3166-1 list)
and the ~11,750 pre-existing `City` rows have **no seed script,
migration, source file, or comment anywhere in this repository**
describing how they were originally populated. This is a known,
unresolved gap — **do not assume or claim the existing dataset carries
any particular license** until its actual origin is identified. If you
discover the source, document it here.

## 2026-09-24: GeoNames-sourced Oil & Gas market coverage

`prisma/data-imports/2026-09-24-oil-and-gas-city-coverage/` adds `City`
rows for six countries that previously had zero coverage — Oman,
Bahrain, Brazil, Nigeria, Angola, Guyana — relevant to Jobnura's Oil &
Gas expansion. Full provenance, the exact GeoNames license (CC BY 4.0),
required attribution, the deterministic curation rule, and per-country
counts are documented in that folder's own `README.md`.

**Required attribution** (per GeoNames' CC BY 4.0 terms) for this
specific dataset: *Geographic data © [GeoNames](https://www.geonames.org),
CC BY 4.0.* This is recorded here and in the import folder's README as
the developer-facing record; no public-facing UI copy was added, since
the license permits attribution "with a link or another reference to
GeoNames" in documentation rather than requiring on-page display, and
no other obligation in this task required a UI change.

This import does **not** apply to, or make any claim about, the
pre-existing 11,750 city rows described above.
