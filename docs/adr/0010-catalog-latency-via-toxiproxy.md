# ADR-0010: catalog's latency comes from Toxiproxy, not from the code

**Date**: 2026-11-08
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Phase 3 planning (D5 staircase)

---

## Context

D5 (sequential awaits in `orders`) is only visible if the independent calls take real
time: the spec asks for `catalog` at ~80 ms per call. On a laptop, an in-memory catalog
answers in ~1 ms, so the "staircase" would be invisible and the `Promise.all` fix
pointless.

## Options Considered

### Option A — Slowness inside catalog (a sleep, a slow query)
- **Cons**: a sleep in participant-visible code is a signpost ("why is this here?") and
  invites "fix the sleep" instead of D5; a slow query varies wildly between laptops.

### Option B — catalog behind Toxiproxy with a latency toxic
`orders` reaches catalog at `http://toxiproxy:8667` (proxy `catalog` → `catalog:3000`);
every `scenarios/lab-N.toxics.json` adds an 80 ms (± 10 ms) downstream latency toxic.
The story: catalog runs in another region.
- **Pros**: catalog's code stays ordinary; latency is infra, like D2/D10; the same tool
  already in the stack; verify can change it if a check ever needs to.
- **Cons**: catalog's server spans report `server.address = toxiproxy`; a fresh `make up`
  without `make lab` has no latency (same as the D2 reset toxic).

## Decision

**Option B.** `scripts/apply-scenario.sh` applies the toxics of every proxy (`psp`,
`catalog`).

## Operational Consequences

- `CATALOG_URL` in compose points at Toxiproxy; the service default stays
  `http://catalog:3000`.
- `apply-scenario.sh` builds the verify image (`--build`), so the toxics applied always
  match the checked-out tag.
