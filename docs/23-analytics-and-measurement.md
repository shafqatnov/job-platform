# 23. Analytics and Traffic Measurement

The v1.0 review identified that nothing in the blueprint described how the platform would know whether its core bet — organic SEO traffic — is actually working. This document makes basic measurement a launch requirement rather than an optional add-on.

## Why this is launch-critical, not deferred

- **[CONFIRMED]** The product direction is to attract organic traffic through useful, fresh, trustworthy job content and strong SEO (see [01-product-vision-and-scope.md](01-product-vision-and-scope.md), [10-seo-architecture.md](10-seo-architecture.md)) — without guaranteeing that traffic will materialize. Basic analytics are what let the team find out, after launch, whether that bet is paying off. Launching without any measurement means launching blind to the platform's own core hypothesis.

## Minimum scope for launch

- **[CONFIRMED]** Basic web analytics on all public pages: page views, traffic source/referrer (to distinguish organic search from other channels), and top-level engagement (e.g. bounce/exit patterns).
- **[RECOMMENDED]** Server-side or client-side event tracking, at minimum, for: a job listing view, an "Apply" click (on-platform or external, see [20-application-flow.md](20-application-flow.md)), and an on-platform application submission. This gives a basic view-to-apply funnel without requiring a full analytics platform.
- **[RECOMMENDED]** A privacy-conscious, cookie-light analytics tool is preferred where it meets the need, to minimize overlap with the consent requirements in [21-adsense-readiness.md](21-adsense-readiness.md); if a cookie-based tool is used instead, it sits behind the same consent mechanism as ad personalization — one consent system, not two.

## Deferred

- **[DEFERRED]** Advanced BI/dashboarding, cohort analysis, or attribution modeling across marketing channels — none of this is needed to answer the launch-critical question ("is organic traffic arriving and converting to applications at all") and can be added once there's enough volume for it to be meaningful.
- **[DEFERRED]** A/B testing infrastructure.
- **[DEFERRED]** Specific analytics vendor/tool choice — left open, subject to the privacy/consent constraints above.
