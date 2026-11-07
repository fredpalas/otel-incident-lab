# ADR-0005: One standalone NestJS 11 app per service, in a pnpm workspace, compiled to CommonJS

**Date**: 2026-11-07
**Status**: Accepted (supersedes the "Express, no DI framework" line in docs/01 and docs/04)
**Deciders**: Workshop lead trainer
**Triggered by**: Phase 0 planning; reference project `reverse-ddd` (NestJS + DDD)

---

## Context

The TS services must look like ordinary production code that senior engineers
recognise, keep a DDD layout (`domain/`, `application/`, `infrastructure/`), and be
instrumented **lab by lab** with OpenTelemetry auto-instrumentation. Each service is a
separate process with its own `service.name` so traces show a real distributed system.

The author's reference (`reverse-ddd`) uses the Nest **monorepo mode**: several apps
under `apps/`, one `package.json`, built with webpack.

## Options Considered

### Option A — Express without a framework (original docs)
- **Pros**: least magic; smallest files.
- **Cons**: hand-rolled wiring in every service; no `instrumentation-nestjs-core`
  spans (controller/handler names in traces).

### Option B — Nest monorepo mode (`apps/*`, shared `package.json`, webpack)
- **Pros**: one install, shared code trivially.
- **Cons**: **webpack bundling breaks OTel auto-instrumentation** (require hooks never
  see `express`, `pg`, `amqplib`); one dependency set for all services, so "add pino to
  orders" changes every service and `make lab` can't restart only what changed.

### Option C — pnpm workspace, one standalone Nest app per service, `tsc` build
- **Pros**: per-service `package.json`, Dockerfile, deps and diffs; unbundled output so
  auto-instrumentation works; Nest DI and decorators familiar to most attendees.
- **Cons**: small duplication of shared-kernel code (accepted: "avoid premature libs").

## Decision

**Option C**, pinned to **NestJS 11.2.8** (Express 5.2.1 via `@nestjs/platform-express`).

- Nest 12 is out (12.4.0), but `@opentelemetry/instrumentation-nestjs-core@0.72.0`
  supports `>=4 <12`. `@opentelemetry/instrumentation-express@0.73.0` supports
  `>=4 <6`, so Express 5 is fine. Re-check both before upgrading.
- Services compile to **CommonJS** (Nest's paved path; decorator metadata just works).
  The OTel bootstrap is still loaded with `node --import ./dist/instrumentation.js`,
  which registers require hooks before the app loads — no ESM loader hooks needed.
  `verify/` and `scripts/` stay ESM (Node type stripping).
- **TypeScript 6.0.3**, not 7.x: TS 7 is the native compiler and Nest relies on
  `emitDecoratorMetadata`; `ts-jest` also requires `typescript <7`.
- DDD kept light so a participant can navigate a service in minutes: value objects for
  ids, money, quantities and statuses; one `ApplicationService` per bounded context
  (no command/query bus); raw `pg` (no ORM) because D4/D6 need visible queries and
  connection handling.

## Operational Consequences

- **CI/CD**: `pnpm -r` typecheck/lint/test per service.
- **Observability**: lab 2 adds `src/instrumentation.ts` per service; Nest handler spans
  come from `instrumentation-nestjs-core`.
- **Rollback plan**: services are small; reverting to bare Express means replacing the
  controller/module layer only — domain and application code don't import Nest
  except for `@Injectable()` on application services.

## Success Criteria

- Auto-instrumentation yields http + express + nestjs + pg spans with zero code in lab 2.
- A participant can locate the checkout use case in < 2 minutes in the dry run.
