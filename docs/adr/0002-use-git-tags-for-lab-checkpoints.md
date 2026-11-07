# ADR-0002: Use a linear solution path with git tags as lab checkpoints

**Date**: 2026-11-07
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Workshop design

---

## Context

With 20–80 participants, some will fall behind or break their environment. Every lab
must be startable from a known-good state, and the material must be testable.

## Options Considered

### Option A — One folder per lab (`lab1/`, `lab2/` full copies)
- **Pros**: no git knowledge needed.
- **Cons**: massive duplication; fixes must be applied N times; drift.

### Option B — Feature flags toggling defects and instrumentation
- **Pros**: single tree.
- **Cons**: participants read flag-riddled code; defects become obvious; unrealistic.

### Option C — Linear history with `lab-N-start` / `lab-N-solution` tags
- **Pros**: realistic code at every step; `git diff lab-2-start lab-2-solution` *is*
  the solution; CI can verify every checkpoint.
- **Cons**: requires history rewrites while building (scripted retagging).

## Decision

**Option C**, wrapped by `make lab N=` / `make solution N=` so participants don't need
git fluency. Tags are immutable checkpoints; participants always work on a local
branch created from the tag (`my/lab-N`), and any uncommitted work is auto-committed
before a jump — never discarded (details in docs/04, "Safe jump").

## Operational Consequences

- **CI/CD**: matrix job per lab — start must FAIL verify, solution must PASS.
- **Rollback plan**: participants can always `make solution N=<current>`.

## Success Criteria

- Nobody blocked > 5 minutes in the dry run.
- CI matrix green for all labs before 13 Nov.
