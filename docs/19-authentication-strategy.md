# 19. Authentication Strategy

The v1.0 review flagged that authentication was left fully open with no directional lean, unlike other infrastructure decisions (e.g. the database recommendation in [07](07-database-architecture.md)). This document gives that direction while still deferring the specific vendor.

## Direction

- **[CONFIRMED]** Authentication is implemented using a proven, off-the-shelf authentication solution (a well-established library or managed auth service), not a custom-rolled session/credential system. Credential handling is a well-known source of security defects when built from scratch, and it is not a differentiating capability for this product.
- **[RECOMMENDED]** At minimum, email/password authentication for all three account types (candidate, employer, admin). Social/OAuth login (e.g. Google sign-in) is a reasonable addition for candidate convenience but is not required for launch.
- **[RECOMMENDED]** Sessions are managed by the chosen off-the-shelf solution's standard mechanism (e.g. secure HTTP-only cookies) rather than a hand-rolled token scheme.

## Role binding

- **[CONFIRMED]** Authentication identifies *who* a user is; authorization (*what they can do*) remains the centralized, module-invoked logic described in [06-user-boundaries.md](06-user-boundaries.md) and [11-security-principles.md](11-security-principles.md). The auth solution is not responsible for enforcing candidate/employer/admin boundaries — it only establishes identity and session.

## Deferred

- **[DEFERRED]** The specific vendor/library (e.g. a particular managed auth service vs. a self-hosted open-source solution) — to be chosen at implementation time based on cost, Next.js integration quality, and data-residency fit for the launch country/countries.
- **[DEFERRED]** Multi-factor authentication, single sign-on for enterprise employer accounts, and passwordless/magic-link flows — none required for launch; can be added later without changing the module boundary above.
