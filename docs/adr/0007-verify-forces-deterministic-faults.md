# ADR-0007: Verify scripts force deterministic faults through Toxiproxy

**Date**: 2026-11-07
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Designing verify-1 (D1 + D2)

---

## Context

Scenario faults are probabilistic on purpose (D2: `reset_peer` on ~5 % of PSP calls),
so the lab feels like production. A verify check that waits for a random fault is
flaky: with 60 checkouts at 5 %, P(no fault at all) = 0.95⁶⁰ ≈ 4.6 %. CI would fail
about once every 20 runs, and a participant who fixed the bug could see ❌.

## Options Considered

### Option A — Bigger bursts
- **Cons**: still probabilistic; burns the 60 s verify budget.

### Option B — Magic inputs in the services (e.g. a card that always fails)
- **Cons**: visible test hooks in participant code; contradicts ADR-0003.

### Option C — Verify temporarily replaces the proxy's toxics, then restores them
- **Pros**: deterministic; no trace of it in service code; same failure path as
  production (connection reset).
- **Cons**: verify mutates shared state while it runs (restored in `finally`).

## Decision

**Option C.** `verify/lib/toxiproxy.ts#withToxics` swaps in the toxics a check needs,
runs its own traffic tagged with a unique `run_id`, and restores the participant's
scenario afterwards. Checks only look at data from their own `run_id`.

## Operational Consequences

- **CI/CD**: no flakiness from scenario randomness.
- **Rollback plan**: `make lab N=<n>` re-applies the scenario toxics if a verify run is
  killed mid-way.

## Success Criteria

- 20 consecutive CI runs of each lab matrix without a flaky result.
