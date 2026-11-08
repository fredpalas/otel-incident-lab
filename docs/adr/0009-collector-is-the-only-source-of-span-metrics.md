# ADR-0009: The Collector is the only source of span metrics and the service graph

**Date**: 2026-11-08
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Phase 3 planning (lab 3: spanmetrics + servicegraph connectors)

---

## Context

Lab 3's first step is to add the `spanmetrics` (with exemplars) and `servicegraph`
connectors to the workshop Collector, then read the Checkout dashboard. But
`grafana/otel-lgtm` 0.40.0 ships Tempo with its **metrics generator** on
(`span-metrics` + `service-graphs` processors, exemplars sent to Prometheus): as soon as
traces flow (lab 2), `traces_spanmetrics_*` and `traces_service_graph_*` already exist.
The lab step would change nothing visible, and verify-3 couldn't tell whether it was
done.

## Options Considered

### Option A — Keep Tempo's generator, add only `spanmetrics` in lab 3
- **Pros**: no override of the lgtm image config; service graph available from lab 2.
- **Cons**: two sets of span metrics with similar names; the servicegraph connector
  can't be taught; "why do I need this, Grafana already has it?".

### Option B — Turn Tempo's generator off; the Collector produces both
Mount `observability/lgtm/tempo-config.yaml` (the image's config without
`metrics_generator` and its overrides) over `/otel-lgtm/tempo-config.yaml`.
- **Pros**: the panels are empty until the participant adds the connectors, then they
  fill: cause and effect. One metric family, named by the connector.
- **Cons**: the service graph disappears from lab 2 (it was a nice-to-have there); the
  copied Tempo config must be re-checked when the lgtm image is upgraded.

## Decision

**Option B.** Metric names are the connectors' defaults:
`traces_span_metrics_calls_total`, `traces_span_metrics_duration_milliseconds_bucket`,
`traces_service_graph_request_total{client, server}`. The Checkout dashboard and verify-3
use those.

## Operational Consequences

- **Upgrading otel-lgtm**: diff its `/otel-lgtm/tempo-config.yaml` against ours.
- **verify-3** requires samples newer than its own run: Prometheus keeps older series
  (lgtm data volume) across `make lab` / `make solution`, so presence alone would pass on
  `lab-3-start` after a solution run.

## Success Criteria

- On `lab-3-start` the trace-derived panels show "No data"; after the connectors, data
  with exemplars within a minute.
