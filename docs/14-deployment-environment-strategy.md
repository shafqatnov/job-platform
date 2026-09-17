# 14. Deployment / Environment Strategy

No hosting, deployment pipeline, or environment configuration exists yet. This document states direction, not a decided setup.

## Recommended environment tiers (for when this is set up)

- **Local** — developer machines, current state.
- **Preview** — an ephemeral environment per pull request, useful for reviewing changes before merge.
- **Staging** — a persistent pre-production environment mirroring production configuration.
- **Production** — live environment serving real users.

## Hosting direction

- **[RECOMMENDED]** Favor a hosting platform well-suited to Next.js out of the box (e.g. Vercel), which naturally provides per-PR preview deployments and avoids standing up custom infrastructure (Kubernetes, custom servers, load balancers) before there's a concrete reason to. This aligns with the explicit instruction to avoid unnecessary infrastructure spend before it's needed.
- **[DEFERRED]** Final hosting provider decision — a cost/ops decision for the project owner, not set by this blueprint.

## Multi-country deployment

- **[RECOMMENDED]** A single global deployment serves all countries (routing and data differentiate by country, per [05-multi-country-architecture.md](05-multi-country-architecture.md)) rather than separate deployments per country. Simpler to operate, and consistent with starting as one application.
- **[DEFERRED]** Regional/data-residency-driven hosting split — only revisited if a specific market's legal requirements demand it.

## Secrets and configuration

- **[CONFIRMED]** Environment variables are not committed to source control (`.env*` already gitignored in the current baseline). Per-environment secrets management (e.g. a secrets manager) is a production-readiness concern for later, not needed at this stage.

## Deferred

- **[DEFERRED]** CI/CD pipeline tooling and specific deployment automation — nothing to deploy yet.
- **[DEFERRED]** Monitoring/observability stack — a Phase 1 build-time decision once there's a running service to observe.
