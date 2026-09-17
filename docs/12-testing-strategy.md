# 12. Testing Strategy

## Current state

- **[CONFIRMED]** No tests exist in the project yet (no test runner or test files are present in the current baseline).

## Recommended layered approach (for when features are built)

- **Unit tests** for domain/module logic (see [03-application-architecture.md](03-application-architecture.md)) — since business rules live in modules rather than UI components, they can be tested without rendering anything.
- **Integration tests** for the data-access layer once a database exists, verifying modules interact with it correctly.
- **End-to-end tests** (e.g. Playwright) for the critical user journeys: a candidate finding and applying to a job; an employer posting a job and reviewing an applicant.
- **SEO/rendering smoke checks** for public pages — confirming key content and structured data render server-side, since that's the whole point of the public-page architecture (see [10-seo-architecture.md](10-seo-architecture.md)).

## Principle enabling this strategy

- **[RECOMMENDED]** Keeping business logic in modules rather than scattered through page/component files (per [03](03-application-architecture.md)) is what makes unit testing practical — it avoids needing to render the full UI to test a business rule.

## CI expectation

- **[RECOMMENDED]** Once a remote/CI is set up (see [13-git-branching-strategy.md](13-git-branching-strategy.md), [14-deployment-environment-strategy.md](14-deployment-environment-strategy.md)), lint, type-check, and test suites run on every pull request before merge.

## Deferred

- **[DEFERRED]** Specific test framework choice (e.g. Vitest vs. Jest for unit tests) — either fits this stack; the decision can wait until the first tests are actually written.
- **[DEFERRED]** Coverage thresholds or enforcement — premature without any code to measure yet.
