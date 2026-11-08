# ADR-0012: Email goes to Mailpit, through Toxiproxy

**Date**: 2026-11-08
**Status**: Accepted
**Deciders**: Workshop lead trainer
**Triggered by**: Phase 4 planning (ticket "paid but no email")

---

## Context

Lab 4's second ticket is "the customer was charged but never got the email". notifier
needs an email provider that sometimes fails, so that retries — and occasionally giving
up — really happen.

## Options Considered

### Option A — An in-process fake mailer that fails at random (`MAIL_FAILURE_RATE`)
- **Cons**: "fails at random" in participant code is a signpost; no inbox to look at.

### Option B — Mailpit behind Toxiproxy
`axllent/mailpit:v1.33.1` (multi-arch, ~20 MB RAM) receives SMTP from notifier
(nodemailer) through a Toxiproxy `smtp` proxy with a `reset_peer` toxic: 10 % in every
scenario, 30 % in lab 4's.
- **Pros**: the failure is infra, like D2 and D10; participants can open the inbox at
  http://localhost:8025 and check whether a customer got their tickets; the retry path
  (TTL queue + dead-letter, 3 attempts) runs for real.
- **Cons**: one more container and port; SMTP has no auto-instrumentation, so notifier's
  `SmtpMailer.send` needs a manual span (added in the lab 4 solution, with `code.*`).

## Decision

**Option B.** With 30 % resets, ~2.7 % of orders exhaust their three attempts and stay
`PAID`, enough for every participant to find their own ticket.

## Operational Consequences

- CI's `static` job runs RabbitMQ and Mailpit as services for notifier's tests.
- `apply-scenario.sh` applies toxics to `psp`, `catalog` and `smtp`.
