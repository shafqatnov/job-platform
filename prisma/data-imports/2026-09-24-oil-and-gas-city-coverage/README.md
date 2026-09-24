# Oil & Gas market City coverage — GeoNames import (2026-09-24)

## Execution record

Executed 2026-09-24 via `npx prisma db execute --file import.sql`. Result
matched the preview exactly: 6,685 rows inserted (Oman 42, Bahrain 12,
Brazil 5,344, Nigeria 913, Angola 350, Guyana 24), total `City` row
count went from 11,750 to 18,435, and every other country's row count
was independently confirmed unchanged (11,750 across all non-target
countries, before and after). Spot-checked post-insert: Muscat,
Manama, São Paulo, Georgetown, Lagos, Luanda all present and correctly
attributed; Wantage (unrelated, UK) still absent as expected — this
import never touches the UK.

## Why

A location-reference-data audit found that six countries relevant to
Jobnura's Oil & Gas expansion had **zero** `City` rows: Oman, Bahrain,
Brazil, Nigeria, Angola, Guyana. Any imported job reporting a city in
one of these countries could never auto-resolve — it would sit in the
unknown-location queue indefinitely, no matter how good the AI's
suggestion was, simply because there was nothing to select.

## Existing reference-data provenance (unrelated to this import)

The pre-existing 11,750 `City` rows already in the database have **no
documented provenance or license anywhere in this repository** — no
seed script, no migration, no source file, no comment. This import
does **not** claim otherwise, and does not retroactively assert a
license for that pre-existing data. This gap should be resolved
separately by whoever can identify the original source.

## Source and license for THIS import

- **Source:** GeoNames (<https://www.geonames.org>), per-country dump
  files downloaded from `https://download.geonames.org/export/dump/{ISO}.zip`
  for `OM`, `BH`, `BR`, `NG`, `AO`, `GY`.
- **Download date:** 2026-09-24.
- **License:** Creative Commons Attribution 4.0 (CC BY 4.0). Confirmed
  directly from GeoNames' own export/license page
  (<https://www.geonames.org/export>): *"cc-by licence (creative
  commons attribution license). You should give credit to GeoNames
  when using data or web services with a link or another reference to
  GeoNames."* Commercial use is explicitly permitted on the same page.
- **Attribution (required by the license):** Geographic data
  © [GeoNames](https://www.geonames.org), CC BY 4.0.
- **Fields incorporated into Jobnura's `City` table:** only `name`
  (GeoNames `asciiname`, falling back to `name`) and a derived `slug`
  (via this repo's own `src/utils/slugify.ts` logic). No coordinates,
  population, alternate names, elevation, or timezone data was carried
  into the application schema — the City model has no such columns.
- **Provenance retained for audit:** `geonames-cities.curated.json` in
  this folder keeps each row's original `geonameid`, `featureCode`, and
  `population` value as downloaded, so the exact GeoNames source record
  behind every inserted city can be traced later even though the `City`
  table itself has no source-tracking column (no schema change was made
  for this task — see "Distinguishing this data" below).

## Curation rule (deterministic, evidence-based)

GeoNames' `PPL` (populated place) feature code alone is far too broad
for a job platform — it covers everything from São Paulo to a
hamlet of a dozen people, and Brazil alone has ~60,000 such rows.
Population data, where the task considered using it as a filter, was
checked directly against the downloaded data first: across all six
countries, GeoNames records a non-zero population for only **0.4%–9.3%**
of populated-place rows (e.g. Oman: 41 of 5,324; Nigeria: 486 of
61,113). A population threshold would therefore have excluded the vast
majority of genuine towns for the wrong reason — the task explicitly
warned against inventing a threshold "merely for convenience," so one
was not used as the primary filter.

Instead, the rule uses only GeoNames' own official feature-code
taxonomy (never a filter on the app's own choice of what counts as
"important"):

- **Tier 1 — always included:** `PPLC` (national capital), `PPLA`
  (seat of a first-order administrative division), `PPLA2` (seat of a
  second-order division, e.g. a Brazilian municipality's seat). These
  are official administrative-seat designations, not a population
  guess.
- **Tier 2 — included only with independent evidence:** `PPL`,
  `PPLA3`, `PPLA4`, `PPLA5` **and** a recorded `population > 0`. Where
  GeoNames does record a real population, that's a genuine, verifiable
  signal even though it's only present for a minority of rows.
- **Excluded entirely:** `PPLX` (a section/suburb of a larger place —
  exactly the "district supplied instead of city" pattern the original
  Wantage case surfaced), `PPLL` (locality, often just a hamlet),
  `PPLQ`/`PPLW` (abandoned/destroyed), `PPLF` (farm village), `PPLR`
  (religious populated place), `PPLS`, `PPLH` (historical).

Within a country, duplicate names (after slugification) are resolved
deterministically: Tier 1 beats Tier 2, then higher recorded
population wins, then the lower GeoNames numeric ID wins — never a
random or order-dependent choice.

## Result

| Country | Candidates before dedup | Tier 1 | Tier 2 | Final rows inserted (candidates) |
|---|---|---|---|---|
| Oman (OM) | 42 | 10 | 32 | 42 |
| Bahrain (BH) | 12 | 1 | 11 | 12 |
| Brazil (BR) | 5,740 | 555 | 5,185 | 5,344 |
| Nigeria (NG) | 927 | 727 | 200 | 913 |
| Angola (AO) | 365 | 240 | 125 | 350 |
| Guyana (GY) | 25 | 10 | 15 | 24 |

Brazil's row count is large in absolute terms but is not arbitrary:
555 of its rows are official municipal seats (Brazil has ~5,570
municipalities nationally), and the remainder all carry independently
recorded GeoNames population data — the same order of magnitude as
this table's existing large countries (Germany: 1,135; Japan: 1,247).

Spot-checked and confirmed present with correct data: Muscat (Oman,
pop. 797,000), Manama (Bahrain, pop. 147,074), Brasília, São Paulo, Rio
de Janeiro (Brazil), Lagos (pop. 15,388,000) and Abuja (Nigeria),
Luanda (Angola, pop. 2,776,168), Georgetown (Guyana, pop. 235,017).

## Distinguishing this data from the pre-existing City rows

No schema change was made for this task (the task explicitly
discouraged one unless absolutely required, and a `source` column
wasn't judged necessary to justify that change). Instead, this import
is distinguishable by:

1. **This folder itself** — `geonames-cities.curated.json` lists every
   `(country, name, slug)` this import touched, with its original
   GeoNames `geonameid` for cross-reference.
2. **Scope** — this import only ever touches the six named countries;
   every one of them had exactly zero pre-existing `City` rows, so
   there is no ambiguity about which rows in those six countries came
   from this import (all of them, as of 2026-09-24).

## Mechanism

`import.sql` in this folder is a plain, idempotent SQL script — safe
to run more than once, since every insert uses
`ON CONFLICT ("countryId", "slug") DO NOTHING`, matching `City`'s own
existing `@@unique([countryId, slug])` constraint exactly. It resolves
each country by ISO code via a subquery (`WHERE c."isoCode" = 'OM'`,
etc.) rather than a hardcoded id, and touches no other table. Run via
the project's own Prisma CLI (already an existing dependency, no new
tooling installed):

```sh
npx prisma db execute --file prisma/data-imports/2026-09-24-oil-and-gas-city-coverage/import.sql --schema prisma/schema.prisma
```

This is a one-time data import, not a tracked Prisma migration (no
schema change occurred) — it is not registered in Prisma's migration
history, deliberately, to avoid interfering with the project's real
schema-migration timeline.
