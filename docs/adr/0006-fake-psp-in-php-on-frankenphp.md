# ADR-0006: Write fake-psp in PHP, served by FrankenPHP, manually instrumented

**Date**: 2026-11-07
**Status**: Accepted (closes ROADMAP open decision #1)
**Deciders**: Workshop lead trainer
**Triggered by**: Phase 0 planning

---

## Context

`fake-psp` simulates a third-party payment provider: a different language from our
services, pre-instrumented, never edited by participants. It must apply latency
profiles (D10: up to 3 s), record received Baggage as span attributes (D8 leak check)
and emit PII attributes (D9).

## Options Considered

### Option A — Go
- **Pros**: tiny static binary, low RAM, mature OTel SDK.
- **Cons**: one more language the author maintains less often.

### Option B — PHP
- **Pros**: author's daily stack; makes the "polyglot third party" point well.
- **Cons**: PHP's built-in server handles **one request at a time** — a 3 s long-tail
  sleep would block every other payment and distort D10. Auto-instrumentation needs a
  PECL extension.

## Decision

**Option B**, with:

- **FrankenPHP 1.13.5 (PHP 8.5.12, alpine)**: multi-arch image, handles concurrent
  requests with threads, so long-tail sleeps don't serialise traffic.
- **Manual instrumentation** with `open-telemetry/sdk` 1.16.1 +
  `open-telemetry/exporter-otlp` 1.5.0 via Composer — no PECL extension. The PSP has a
  single endpoint; manual spans are clearer for a "vendor" service anyway.
- W3C TraceContext + Baggage propagators extracted explicitly.

## Operational Consequences

- **Infrastructure**: Composer deps are installed at image build time (`make pull`).
- **Rollback plan**: the PSP contract is one HTTP endpoint; a Go replacement is a
  half-day job if FrankenPHP misbehaves on some laptop.

## Success Criteria

- Under baseline load with the long-tail profile, p50 of PSP calls stays < 120 ms
  (no head-of-line blocking).
- RAM of the fake-psp container < 150 MB.
