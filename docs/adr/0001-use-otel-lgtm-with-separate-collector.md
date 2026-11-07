# ADR-0001: Use grafana/otel-lgtm behind a separate, participant-editable Collector

**Date**: 2026-11-07
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Workshop design

---

## Context

Up to 80 participants run the full stack on their own laptops (min 8 GB RAM) with
unreliable venue Wi-Fi. The workshop needs Loki, Tempo, Prometheus and Grafana with
cross-links, and participants must edit a Collector pipeline (spanmetrics, redaction).

## Options Considered

### Option A — Individual containers (Grafana, Loki, Tempo, Prometheus, Collector)
- **Pros**: full control, production-like.
- **Cons**: 5+ images to pull and configure; more RAM; more failure points on 80 laptops.

### Option B — `grafana/otel-lgtm` only (its internal Collector)
- **Pros**: one image, sane defaults, starts in seconds.
- **Cons**: the internal Collector config is buried in the image; editing it per lab
  is awkward for participants.

### Option C — `otel-lgtm` + separate `opentelemetry-collector-contrib` in front
- **Pros**: one backend image; a readable `observability/collector/config.yaml`
  participants own; mirrors the real "Collector as gateway" pattern.
- **Cons**: one extra hop and container (~100 MB RAM).

## Decision

**Option C.** Keeps the backend trivial while making the Collector a first-class,
editable part of the labs.

## Operational Consequences

- **Infrastructure**: two observability containers; Grafana datasources provisioned
  by mounting files into otel-lgtm.
- **CI/CD**: verify scripts query backend APIs inside the compose network.
- **Observability**: Collector exports OTLP to otel-lgtm:4317.
- **Security**: Grafana anonymous admin locally only; MCP uses a Viewer token.
- **Rollback plan**: point services straight at otel-lgtm:4318 (Option B) if the
  separate Collector causes problems on the day.

## Success Criteria

- Stack < 4 GB RAM, cold start < 90 s with images pre-pulled.
- No participant blocked by the observability stack in the dry run.

## References

- https://github.com/grafana/docker-otel-lgtm
