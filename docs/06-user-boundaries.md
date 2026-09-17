# 6. Candidate, Employer, and Admin Boundaries

## Three actor types

- **Candidate** — job seeker: profile, applications, saved jobs.
- **Employer** — represents a company: job postings, applicant review, company profile.
- **Admin** — internal operations: moderation, platform integrity, support.

Public visitors (not authenticated as any of the above) are a fourth, implicit category with read-only access to public SEO pages — see [10-seo-architecture.md](10-seo-architecture.md).

## Confirmed boundary principles

- **[CONFIRMED]** Each role has a distinct authenticated dashboard experience within the single app, kept separate at the routing level (see [04-routing-and-url-strategy.md](04-routing-and-url-strategy.md)) so their layouts, navigation, and data do not bleed into one another.
- **[CONFIRMED]** The public SEO surface is decoupled from all three authenticated boundaries — a visitor never needs an account, and none of the three dashboards are indexed or publicly browsable.

## Data and logic boundaries

- **[RECOMMENDED]** Each domain module (see [03-application-architecture.md](03-application-architecture.md)) owns its own data access. For example, the employer module does not directly read or write candidate profile data; if it needs candidate information (e.g. an applicant's profile on an application), it goes through an interface the candidate module exposes for that purpose.
- **[RECOMMENDED]** Authorization ("can this user perform this action") is centralized logic invoked by each module, not duplicated `if (role === 'admin')` checks scattered across UI components. This keeps the eventual real implementation auditable from one place.

## Admin as a superset, not a shortcut

- **[RECOMMENDED]** Admin capability is modeled as its own module with explicit, scoped actions (e.g. "hide a job listing", "suspend a user") rather than admins simply being granted unrestricted access to candidate/employer internals. This keeps the audit trail meaningful and limits blast radius of an admin-account compromise.

## Deferred

- **[DEFERRED]** The specific authentication vendor/library — the direction (a proven off-the-shelf solution, not custom-rolled) is now confirmed in [19-authentication-strategy.md](19-authentication-strategy.md); only the specific provider remains open.
- **[DEFERRED]** Whether employers can have multiple team members/seats with different permission levels within one company account — a real product question for a later phase, not decided here.
