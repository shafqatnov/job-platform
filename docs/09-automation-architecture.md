# 9. Automation Architecture Principles

No automation exists in this project yet (no background jobs, schedulers, or workers). This document states principles for when automation is introduced (Phase 3, see [02-mvp-vs-future-phases.md](02-mvp-vs-future-phases.md)).

## Core principle

- **[CONFIRMED]** Automation (notification emails, scheduled digests, data sync, moderation flags, automated job expiry, etc.) is implemented as decoupled background work, not embedded inline in request/response UI code paths. A page render or form submission should not be doing automation's job synchronously.
- **[CONFIRMED]** The transition of a job from `active` to `expired` when its `expiresAt` date passes (see [18-job-lifecycle.md](18-job-lifecycle.md)) is a concrete, launch-required example of this principle — it is a scheduled background task, not something triggered by a user request.
- **[RECOMMENDED]** Automation logic lives in its own module (see [03-application-architecture.md](03-application-architecture.md)) behind a queue/scheduler abstraction, so the underlying job runner can be swapped or extracted into a separate worker process later without changing how other modules trigger automation.

## Operating principles for when this is built

- **[RECOMMENDED]** Automated tasks are designed to be idempotent and safely retryable — a task that runs twice (e.g. due to a retry) should not double-send a notification or double-apply a state change.
- **[RECOMMENDED]** Failures in automation are observable (logged/alertable) rather than silent, since by definition no user is watching a background job run.

## Explicitly deferred

- **[DEFERRED]** Specific queue/scheduler technology (e.g. a hosted queue, a cron-based approach, a job-processing library).
- **[DEFERRED]** Workflow orchestration tooling — not justified until automation needs exceed simple, independent scheduled/triggered tasks.
