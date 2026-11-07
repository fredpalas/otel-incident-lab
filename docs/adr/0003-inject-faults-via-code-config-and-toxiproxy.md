# ADR-0003: Inject faults through plain code, config defaults and Toxiproxy

**Date**: 2026-11-07
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Workshop design

---

## Context

The workshop teaches that incidents have three origins: our code, our configuration,
and things outside our control. Participants should practise telling them apart.

## Options Considered

### Option A — Chaos library inside the services (random throws/sleeps)
- **Pros**: easy to control.
- **Cons**: participants find `chaos.maybeFail()` in the code and stop investigating;
  not realistic.

### Option B — Mixed: realistic code bugs + bad config defaults + network/dependency faults
- **Pros**: each class of fault is found differently; mirrors real incidents; the
  "not our code" lesson (D2, D10) is authentic.
- **Cons**: more moving parts (Toxiproxy, fake-psp profiles).

## Decision

**Option B.** Code defects are ordinary code; config defects are env defaults;
infra faults come from Toxiproxy toxics and fake-psp latency profiles, selected by
`scenarios/lab-N.*` files.

## Operational Consequences

- **Infrastructure**: Toxiproxy container; fake-psp honours `PSP_LATENCY_PROFILE`.
- **Rollback plan**: `make reset` removes toxics and restores defaults.

## Success Criteria

- In the dry run, participants classify each defect as code/config/infra correctly
  without being told.
