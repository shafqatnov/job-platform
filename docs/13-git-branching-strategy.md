# 13. Git and Branching Strategy

## Current state

- **[CONFIRMED]** Single local repository, one baseline commit (`chore: initialize job platform`) on branch `master`, no remote configured.
- **[CONFIRMED]** Commit messages follow a Conventional Commits style (`chore:`, and by extension `feat:`, `fix:`, `docs:`, `refactor:` as work progresses).

## Recommended model going forward

- **[RECOMMENDED]** Trunk-based development: a single long-lived main branch, with short-lived feature branches (e.g. `feature/...`, `fix/...`, `docs/...`) merged back via pull request. Avoid long-lived divergent branches while the team and codebase are small — they cost more in merge conflicts than they save in isolation.
- **[RECOMMENDED]** When a remote is introduced, rename the default branch from `master` to `main` for consistency with current conventions. Not performed now, since this task is documentation-only and explicitly must not change repository state beyond adding docs.
- **[RECOMMENDED]** Once a remote and CI exist, protect the default branch and require passing CI checks (lint, type-check, tests) before merge (see [12-testing-strategy.md](12-testing-strategy.md), [14-deployment-environment-strategy.md](14-deployment-environment-strategy.md)).

## Deferred

- **[DEFERRED]** Choice of git hosting provider/remote — no remote exists yet and none is being added as part of this task.
- **[DEFERRED]** Formal PR review requirements (number of approvals, CODEOWNERS) — premature before there is more than one contributor.
