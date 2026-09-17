# 25. Launch Checklist

Purpose: give this project a concrete, real production-launch endpoint, so it does not become an endless development project. Anything not listed here is, by definition, not required to launch and should be treated as explicitly deferred (see each linked document's "Deferred" section) rather than quietly pulled forward into launch scope.

This checklist consolidates the "launch critical" findings from the v1.0 architecture review into one place. It does not introduce new decisions beyond what is already stated in the linked documents.

## Product

- [ ] Candidate can create a profile, browse/search jobs, and apply — on-platform or via external link per [20-application-flow.md](20-application-flow.md).
- [ ] Employer can create a company profile and submit a job listing, per [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md).
- [ ] Employer can view applicants for their on-platform-application listings.
- [ ] Job listings carry lifecycle states (`pending_review`, `active`, `expired`, `closed`, `rejected`) per [18-job-lifecycle.md](18-job-lifecycle.md), with automated expiry.

## Content trust and quality

- [ ] Basic duplicate-detection check runs at job submission, per [17](17-job-sourcing-and-content-integrity.md).
- [ ] Every job listing passes manual admin moderation before becoming publicly visible, per [17](17-job-sourcing-and-content-integrity.md).
- [ ] No third-party job aggregation/import exists at launch — sourcing is employer-self-service only, per [17](17-job-sourcing-and-content-integrity.md).

## Access and security

- [ ] Authentication is implemented via a proven off-the-shelf solution for all three account types, per [19-authentication-strategy.md](19-authentication-strategy.md).
- [ ] Candidate, employer, and admin dashboards are access-controlled and separated, per [06-user-boundaries.md](06-user-boundaries.md).
- [ ] Admin moderation actions are logged, per [11-security-principles.md](11-security-principles.md).

## Legal and monetization readiness

- [ ] Privacy Policy, Terms of Service, About, and Contact pages are live, per [21-adsense-readiness.md](21-adsense-readiness.md).
- [ ] A cookie/consent mechanism is in place before any ad or non-essential analytics cookies fire, per [21](21-adsense-readiness.md) and [23-analytics-and-measurement.md](23-analytics-and-measurement.md).
- [ ] Baseline legal/privacy compliance is confirmed for the specific launch country/countries (full per-country legal review beyond that remains deferred per [05-multi-country-architecture.md](05-multi-country-architecture.md)).
- [ ] Ad slots, if enabled, are reserved without shifting layout and do not block search/apply flows, per [21](21-adsense-readiness.md). AdSense approval itself is not a launch blocker — the platform must be able to launch and function whether or not AdSense is active.

## SEO and measurement

- [ ] Sitemap(s) and `robots.txt` are live and correct, per [10-seo-architecture.md](10-seo-architecture.md).
- [ ] `JobPosting`/`Organization` structured data renders on relevant public pages, per [10](10-seo-architecture.md).
- [ ] Basic analytics (page views, traffic source, job-view-to-apply funnel) are live, per [23](23-analytics-and-measurement.md).

## Explicitly not required to launch

The following are documented and deferred, not missing by oversight — see each document for detail:

- Third-party job aggregation/imports — [17](17-job-sourcing-and-content-integrity.md)
- AI-assisted matching, resume parsing, semantic search — [08-ai-architecture.md](08-ai-architecture.md), [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)
- Employer monetization (paid/featured listings, subscriptions) — [22-future-monetization.md](22-future-monetization.md)
- Public API and native mobile app — [24-api-and-mobile-readiness.md](24-api-and-mobile-readiness.md)
- Multi-language content translation, subdomain/ccTLD strategy — [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md)
- Automated spam/fraud scoring, fuzzy/semantic duplicate detection — [17](17-job-sourcing-and-content-integrity.md)
- Dedicated search infrastructure, caching layer, multi-region hosting — [15-scalability-principles.md](15-scalability-principles.md)
