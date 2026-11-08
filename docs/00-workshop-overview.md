# 00 — Workshop overview

## Title

**Production Incident Lab: Debugging Distributed Systems with OpenTelemetry**

## Event constraints

| | |
|---|---|
| Event | Upskilling Week Barcelona (MWCapital + Barcelona Activa + Generalitat) |
| Dates | 16–19 Nov 2026, slots 15:00–20:30 |
| Venue | Media TIC, Barcelona |
| Duration | **3 h 30'** incl. 10' break |
| Group | 20–80 participants, >80 % senior |
| Language | English (can be delivered in Spanish) |
| Machines | Participants' own laptops, min 8 GB RAM. Venue Wi-Fi is unreliable → everything pre-pulled. Fallback: GitHub Codespaces |
| Cost | No cloud accounts, no paid services for labs 1–4 |

## Learning goals

1. Explain what observability adds beyond monitoring and where OpenTelemetry fits.
2. Instrument services with OTel (zero-code + manual) and export via the Collector.
3. Correlate logs ↔ traces ↔ metrics in Grafana to go from symptom to root cause.
4. Read traces to locate failures and latency (comb, staircase, gaps, long tail).
5. Propagate context across sync and async boundaries; use a correlation id to follow
   a business case across many traces.
6. See why an AI agent is only as good as your telemetry, and how to give it safe,
   least-privilege access (MCP).

## Narrative principle

Every lab starts from a **symptom** a user or support would report, never from
"now add X". Instrumentation is added because the previous signal was not enough:

> nothing → logs (generic error, origin unknown) → traces (origin + latency)
> → business attributes + correlation id (who/which order) → agent over MCP

**Labs 1–4 are done without AI.** Lab 5 replays the same investigation with an agent.

## Agenda (210')

| Time | Block | Defects |
|---|---|---|
| 10' | Intro: observability vs monitoring; OTel in 5 minutes (signals, SDK, Collector, OTLP, context propagation) | — |
| 5' | Meet the system + the support ticket | — |
| 25' | **Lab 1 — Silent failure** | D1, D2 |
| 45' | **Lab 2 — Traces** | D2, D3 |
| 10' | Break | — |
| 40' | **Lab 3 — Latency** | D10, D4, D5, D6 |
| 45' | **Lab 4 — Follow the order** | D7, D8 + correlation id |
| 25' | **Lab 5 — Agent + MCP, and wrap-up** (strategy, sampling, cost, D9 PII) | incident-5, D9 |
| 5' | Buffer (Q&A; setup issues are handled during the intro) | — |

Slots follow the timed replay of phase 6 (`labs/INSTRUCTOR.md`, "Timing reality").

## Success criteria for the material

- ≥ 90 % of participants reach `verify` PASS in labs 1–3 (with checkpoints).
- Nobody is blocked > 5 minutes: every lab has a `lab-N-start` tag that works standalone.
- Stack runs in < 4 GB RAM; cold start < 90 s with images pre-pulled.
