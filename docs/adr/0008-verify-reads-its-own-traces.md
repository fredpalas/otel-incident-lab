# ADR-0008: Verify sends its own traceparent and reads exactly that trace

**Date**: 2026-11-07
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Designing verify-2 (D2 origin, D3 retries)

---

## Context

From lab 2 the checks are about the *shape* of a request's trace: which span is the
deepest error, how many calls payments makes to the PSP, which attributes the PSP saw.
Verify must look at the traces of **its own** requests, not at whatever baseline traffic
or other participants' experiments produced. Business attributes (order id on spans)
only arrive in lab 4, so there is nothing on the spans to search by in lab 2.

## Options Considered

### Option A — TraceQL search by time window and service
- **Cons**: mixes in baseline load (`make load`) and manual tests; counts become fuzzy.

### Option B — Tag requests with a business attribute and search for it
- **Cons**: requires instrumentation participants haven't written yet (lab 4).

### Option C — Verify chooses the trace id
Verify sends `traceparent: 00-<random trace id>-<span id>-01` on each checkout. Once the
gateway is instrumented it continues that trace, and verify fetches it with
`GET /api/traces/<id>`.
- **Pros**: exact, deterministic, no coupling to later labs; also proves context
  propagation end to end (a missing hop = missing spans).
- **Cons**: a trace is complete only when every service's batch has been exported, so
  verify polls until all expected services appear (≤ 25 s).

## Decision

**Option C** (`verify/lib/traffic.ts#tracedCheckouts`, `verify/lib/tempo.ts#getTrace`).
When the first traced run finds no trace at all, later waits are shortened so a
`lab-N-start` run stays under the 60 s verify budget.

## Operational Consequences

- **CI/CD**: no dependence on background traffic.
- **Rollback plan**: none needed; checks that don't need traces keep using Loki/Postgres.

## Success Criteria

- Each trace-based check identifies the right failure in an intermediate state (tracing
  added, defect not fixed) — tested for D3: 4 PSP calls per checkout, 20 keyless charges.
