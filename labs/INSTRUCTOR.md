# Instructor runbook — Production Incident Lab (210')

Per-lab notes live next to each lab (`labs/0N-*/INSTRUCTOR.md`). This file is the
session as a whole: what to prepare, the clock, and what to do when things go wrong.

## A week before

- Send the setup instructions (README "Before the workshop", and
  `docs/windows-wsl2.md` for Windows) and ask everyone to run `make doctor`,
  `make pull` and `make up` at home. Disk: ~15 GB; RAM: Docker ≥ 4 GB.
- Ask the organisers for power strips at every table and a wired connection for the
  projector laptop.

## The day before (instructor laptop)

- `git pull`, `make pull`, `make reset`, `make up`; `make verify N=1…5` on each
  `make solution N` (or let CI's last green run vouch for it).
- Lab 5: `make lab N=5`, `make mcp-token`, check the agent sees the `grafana` server.
- Record / refresh the fallback video of the lab 5 demo.
- Copy the repo and the image tarball to a USB stick for people who couldn't pull:
  `docker save $(docker compose --profile tools --profile load --profile ai config --images | sort -u) | gzip > images.tar.gz`
  (they load it with `docker load < images.tar.gz`, then `make up` builds offline only
  if they also have the build cache — otherwise send them to Codespaces).

## Room check (first 10' of the intro, while people settle)

- Everyone: `make doctor && make up` → Grafana at <http://localhost:3000>.
- Not working after 5': pair them with a neighbour, or Codespaces (README, plan B),
  or the USB stick.

## The clock

| Time | Block | Instructor focus |
|---|---|---|
| 0–10 | Intro: observability vs monitoring, OTel in 5' | slides; room check running in parallel |
| 10–15 | Meet the system: `docs/01` diagram, the support ticket | show the Checkout dashboard (empty) |
| 15–40 | Lab 1 — Silent failure (25') | `labs/01-silent-failure/INSTRUCTOR.md` |
| 40–85 | Lab 2 — Traces (45') | `labs/02-traces/INSTRUCTOR.md` |
| 85–95 | Break | `make lab N=3` and **`make load`** on the projector, everyone does the same: the lab 3 heatmap needs a few minutes of traffic |
| 95–135 | Lab 3 — Latency (40') | `labs/03-latency/INSTRUCTOR.md` |
| 135–180 | Lab 4 — Follow the order (45') | `labs/04-follow-the-order/INSTRUCTOR.md` |
| 180–205 | Lab 5 — Agent + MCP, wrap-up (25') | `labs/05-ai-mcp/INSTRUCTOR.md` |
| 205–210 | Buffer / Q&A | the room check during the intro absorbs most setup issues |

Measured timings and where they don't hold: see "Timing reality" below.

## Keeping the room together

- Every lab starts from its own tag: whoever is behind runs `make lab N=<next>` and
  is back in sync in ~30 s (offline). Say it out loud at the start of each lab.
- `make solution N` is not cheating; it's the escape hatch. Suggest it at the
  lab's "if the group is behind" point (each lab's notes).
- `make where` tells you (and them) which lab/branch they're on.
- Work is never lost: `make lab`/`make solution` commit it on their branch first.

## When things go wrong

| Symptom | Fix |
|---|---|
| `make up` fails on one service | `docker compose logs <service>`; `make down && make up`. RabbitMQ occasionally fails its first boot on busy machines; it restarts by itself. |
| Grafana has no logs at all | Docker disk > 90 % (Loki stops ingesting): `make doctor`; `docker system prune`. |
| Laptop at 100 % CPU / swapping | `make down`, close browsers' extra tabs, Docker RAM ≥ 4 GB; else Codespaces. |
| "My change does nothing" | they didn't run `make up` after editing (it rebuilds the changed service). |
| Collector change ignored | `make up` restarts the Collector when its config changed; a broken config prints the error. |
| Someone's agent writes their code in labs 1–4 | don't police; ask them in lab 5 how much of the agent's work they now understand. |
| No Wi-Fi at all | everything after `make pull` is offline, including `make lab`, `make solution`, verify and lab 5's MCP server (the LLM itself needs network: play the demo video). |

## Timing reality (phase 6 replay, 8 Nov 2026)

Measured on a fast Linux machine by replaying every lab from `main` the way a
participant does it (`make lab`, edit, `make up` after each README step, `make verify`).
Laptops: expect 2–3× the machine times. Human time is an estimate for a senior engineer
who knows TypeScript but not this codebase or Grafana's UI.

| Lab | Slot | Machine time measured | Change to write | Estimated human time | Holds? |
|---|---|---|---|---|---|
| 1 | 25' | ~1.5' (lab 20 s, repro 20 s, 2 rebuilds 18 s, verify 30 s) | orders logger + D1 (~30 lines; others copy-paste) | 20–25' | ✅ |
| 2 | 45' | ~2' (5 rebuild cycles 5–41 s, verify 15 s) | 6× instrumentation + CMD, Collector, 2 log changes, 3 D3 changes (21 files, +257) | 40–50' (30–35' doing only 3 services) | ✅ with the 3-service lever |
| 3 | 40' | ~2' + **3–5' of `make load` before the heatmap shows the tail** | Collector connectors, D4 queries, D5, D6 (7 files, +75/−46) | 35–45' | ✅ if `make load` runs from the break |
| 4 | 45' | ~2' (multi-service rebuild 42 s, verify 35 s) | attributes + D7, correlation_id × 6 services, strip, envelope + link (26 files, +258) | 40–60' | ⚠️ live-code the envelope + link at minute 32 if needed |
| 5 | 25' | agent 1–2' per phase, rebuild 4–16 s | demo | 25' | ✅ |

The original 180' agenda gave the labs 135'; the measured need was ~160–205'. The
session is 210', so the slots above follow the measurements: labs get 180' and the
buffer shrinks to 5' (setup problems are handled during the intro).
