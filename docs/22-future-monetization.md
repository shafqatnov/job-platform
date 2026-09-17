# 22. Future Employer Monetization (Deferred)

The v1.0 review noted that beyond "not in MVP," no direction existed for how the platform might eventually generate revenue from employers. This document records that direction as explicitly deferred — no payments infrastructure is implemented now.

## Direction (not built now)

- **[DEFERRED]** Paid or featured job listings (e.g. a listing surfaced higher in search results or visually highlighted) — a plausible future revenue stream, not part of launch.
- **[DEFERRED]** Subscription tiers for employers (e.g. bulk posting allowances, longer listing duration, applicant-management features gated behind a paid plan).
- **[DEFERRED]** Any premium candidate-facing feature (e.g. profile boosting) — lower priority than employer monetization and not scoped in detail here.

## Principle for now

- **[RECOMMENDED]** The data model should not actively preclude adding a `plan`/`featured` concept to an employer or job record later (e.g. avoid modeling "employer" in a way that assumes exactly one flat tier forever), but no such field, billing logic, or payment integration is built as part of this blueprint or its launch scope. This is a "don't paint yourself into a corner" note, not a schema requirement to implement now.
- **[CONFIRMED]** No payment processing, billing, or subscription logic exists in Phase 1, consistent with the project's explicit instruction not to implement payments.

## Deferred until when

- **[RECOMMENDED]** Revisit employer monetization once the platform has real employer demand signal post-launch (e.g. employers asking for more visibility or higher posting volume) — an evidence-driven trigger, not a calendar date, consistent with the scale-when-needed principle in [15-scalability-principles.md](15-scalability-principles.md).
