# 8. AI Architecture Principles

No AI capability is implemented in this project yet. This document states principles for how AI should be integrated when it is built (Phase 2, see [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)).

## Core principle

- **[CONFIRMED]** AI capability must not be tightly coupled to UI code. All AI functionality is accessed through a dedicated AI module/adapter with an explicit input/output contract (e.g. "given a job description and a candidate profile, return a match score and rationale"), regardless of which underlying model or provider implements it.
- **[CONFIRMED]** This boundary is what allows the AI provider, model, or approach to change later without touching UI or other domain modules.

## Content-integrity guardrail

- **[CONFIRMED]** AI is never used to rewrite, paraphrase, or otherwise disguise job content the platform is not authorized to redistribute as though it were original. This applies to any future non-employer-sourced content (see [17-job-sourcing-and-content-integrity.md](17-job-sourcing-and-content-integrity.md)); at launch it is moot, since the only source is direct employer submission. AI's role on job content is limited to structuring/enrichment (e.g. extracting fields, suggesting improvements to the *employer's own* description), never generating a substitute description presented as original content.

## Anticipated use cases (Phase 2+, not built now)

- Resume parsing/structuring into a normalized candidate profile.
- Candidate-to-job matching and ranking.
- Job description quality feedback for employers.
- Semantic/AI-assisted job search.

## Operating principles for when this is built

- **[RECOMMENDED]** AI output is treated as a suggestion/augmentation surfaced to a human, not an authoritative or automatic action — especially for anything affecting a candidate's outcome (e.g. rejection). Keep a human in the loop for high-stakes decisions.
- **[RECOMMENDED]** Non-real-time AI work (e.g. batch matching across many jobs/candidates) runs asynchronously/in the background (see [09-automation-architecture.md](09-automation-architecture.md)) rather than blocking a user-facing request.
- **[RECOMMENDED]** AI module inputs/outputs are logged in a way that supports debugging and fairness review, without storing more personal data than necessary.

## Explicitly deferred

- **[DEFERRED]** Choice of AI provider(s)/models.
- **[DEFERRED]** Prompt management/versioning approach.
- **[DEFERRED]** Whether embeddings/a vector store are needed, and if so which one.
- **[DEFERRED]** Fine-tuning vs. prompting vs. hybrid approaches.
