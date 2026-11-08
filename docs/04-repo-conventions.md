# 04 — Repo conventions

## Layout

```
otel-incident-lab/
├── AGENTS.md                     # participant-facing agent rules (coach mode) — see docs/06
├── CLAUDE.md                     # imports AGENTS.md (Claude Code)
├── GEMINI.md  .github/copilot-instructions.md  .cursor/rules/workshop.mdc   # pointers to AGENTS.md
├── .claude/settings.json         # coach-mode hooks (committed)
├── scripts/agent-guard/          # hook scripts + tests
├── README.md                     # participant setup: prerequisites, make pull, make up
├── Makefile
├── docker-compose.yml            # profiles: default | bonus | ai
├── pnpm-workspace.yaml
├── services/
│   ├── gateway/ orders/ inventory/ catalog/ payments/ notifier/   # TS
│   └── fake-psp/                                                  # PHP (FrankenPHP)
├── packages/                     # shared TS (only if truly shared; avoid premature libs)
├── observability/
│   ├── collector/config.yaml
│   └── grafana/provisioning/{datasources,dashboards}/
├── scenarios/
│   ├── lab-1.env  lab-1.toxics.json  …
│   └── incident-5/               # patch + env (spoiler)
├── loadgen/                      # baseline.js, repro-1.js, spike.js, …
├── verify/                       # TS verify scripts, run in a container on the compose network
├── labs/01-silent-failure/ … 05-ai-mcp/
├── docs/                         # docs/authoring/ = builder context
└── .mcp.json                     # lab 5 only
```

## Git model: linear solution path + tags

- Branch **`solution-path`**: linear history; each lab's start and solution are
  commits on it, tagged `lab-N-start` and `lab-N-solution`.
- `lab-(N+1)-start` = `lab-N-solution` + next scenario + lab README. Usually the
  same tree plus docs, but tag it separately anyway.
- **`main`** = `lab-1-start` (what participants clone). Fast-forwarded only when
  rebuilding from scratch; never contains later solutions.
- Rewriting history is allowed before the event (`scripts/retag.sh` re-creates tags
  from commit message markers `[lab-N-start]` / `[lab-N-solution]`).
- Docs under `docs/` and `labs/*/INSTRUCTOR.md` may exist on every tag; spoilers
  (`SOLUTION.md`, `scenarios/incident-5`) are fine in repo — this is a workshop, not a CTF —
  but never in a participant README's visible text.

## Makefile contract

| Target | Behaviour |
|---|---|
| `pull` | Pull every image (pinned by digest, incl. profiles `tools`, `load`, `ai`) and build the local ones; afterwards everything works offline: `up`, `lab`, `solution`, `verify`, `mcp-token`, `incident-5` (verified in a network-less Docker-in-Docker, phase 6). ~7 GB images + ~6 GB build cache: jumping between tags rebuilds only the source layers, the dependency layers come from the cache |
| `up` / `down` | Compose up (detached) / down |
| `reset` | Down with volumes, re-seed DB |
| `lab N=` | Safe jump (see below) to `lab-N-start`, apply `scenarios/lab-N.*`, restart services |
| `solution N=` | Safe jump to `lab-N-solution` |
| `save` | Commit current work on the participant's branch (`wip: <timestamp>`) |
| `where` | Print current lab, branch, dirty files, active scenario |
| `verify N=` | Run `verify/lab-N.ts`; exit 0/1; human-readable ✅/❌ per check with a hint on ❌ |
| `repro N=` | Run the k6 repro script for that lab |
| `load` / `spike` | Baseline traffic / load spike |
| `incident-5` | Apply incident-5 scenario |
| `doctor` | Check Docker, RAM, ports free, images present |

Windows: targets must also work from WSL2. Keep Make recipes POSIX sh.

### Safe jump (`scripts/jump.sh`, used by `lab` and `solution`)

Participants must never lose work and never end up in detached HEAD:

1. If the tree is dirty, auto-commit it on the current branch as
   `wip: before jump to <target> (<timestamp>)`. Never `reset --hard`, never discard.
   (Untracked files included; `.env*` and volumes are git-ignored and untouched.)
2. Create (or reuse with a suffix `-2`, `-3`…) a **local branch from the tag**:
   `my/lab-N` for `lab N=`, `solution/lab-N` for `solution N=`. Tags themselves are
   never moved by participants.
3. Print how to get back: `git switch my/lab-2` (their previous work) and
   `git diff lab-N-start` (their changes vs. the start).
4. Apply the scenario, restart only the services whose code or env changed.

Tags are the immutable checkpoints; branches are where participants work.

## Verify contract

- Each check: `{ id, description, run(): Promise<Pass|Fail(hint)> }`.
- Checks query **backends' HTTP APIs** (Tempo `/api/search` with TraceQL, Loki
  `/loki/api/v1/query_range`, Prometheus `/api/v1/query`) and Postgres. Never parse
  container stdout.
- Each verify first generates its own deterministic traffic (k6 or fetch) with a
  unique `run_id`, waits for ingestion (poll with timeout ≤ 30 s), and only looks at
  telemetry from that run.
- Total runtime per lab ≤ 60 s.

## CI (GitHub Actions)

Matrix per lab N: checkout `lab-N-start` → `make up && make verify N` must **FAIL**;
checkout `lab-N-solution` → must **PASS**. Plus: `tsc --noEmit`, lint, unit tests,
compose memory measurement (report).

## Code style

- TS strict, Node 24, no `any`, explicit return types. Services: NestJS 11, CommonJS
  (ADR-0005). `verify/` and `scripts/`: ESM.
- Small files, `domain/` / `application/` / `infrastructure/` folders, light DDD.
- Defects must look like ordinary code — no tell-tale comments.
- Conventional commits; solution commits `fix(lab-N): …`.
