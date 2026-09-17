# 15. Scalability Principles

## Core principle

- **[CONFIRMED]** Scale the architecture only when real usage data demands it. Do not adopt infrastructure complexity or cost (microservices, dedicated search clusters, caching layers, multi-region databases) in anticipation of load that doesn't exist yet.

## What makes future scaling possible without a rewrite

- The modular monolith boundaries described in [03-application-architecture.md](03-application-architecture.md) are the mechanism for future scaling: a specific module (e.g. AI matching, or search) can be extracted into its own service later *if* it demonstrably needs independent scaling — because it was already isolated behind a clean interface, not because the whole app is rearchitected at that point.
- Country-as-a-dimension in the data model (see [05-multi-country-architecture.md](05-multi-country-architecture.md)) doesn't block sharding or partitioning by country later, without requiring it now.

## What is explicitly not needed yet

- **[DEFERRED]** Dedicated search infrastructure (e.g. Elasticsearch/Algolia) — the primary database is assumed sufficient until real query volume or relevance requirements prove otherwise.
- **[DEFERRED]** A caching layer (e.g. Redis) — not justified without real read-load data.
- **[DEFERRED]** Database read replicas or sharding.
- **[DEFERRED]** Multi-region infrastructure — a single-region deployment is sufficient at current and near-term expected scale.
- **[DEFERRED]** Microservices or a monorepo split (reiterated from [03-application-architecture.md](03-application-architecture.md) since it's the most consequential premature-scaling temptation to avoid).

## Principle for revisiting these

- **[RECOMMENDED]** Each deferred item above should be revisited when there is a concrete, measured symptom (e.g. observed search latency, observed database load) — not on a calendar schedule and not speculatively.
