# Production Incident Lab: Debugging Distributed Systems with OpenTelemetry

A deliberately broken concert-ticketing system and a local Grafana stack. You will
find and fix production incidents by adding observability step by step:
no signals → logs → traces → business context → an AI agent doing the same over MCP.

## Before the workshop (at home, ~10 minutes)

Venue Wi-Fi is unreliable: pull everything beforehand.

**You need**: Docker Desktop (macOS / Windows with WSL2) or Docker Engine (Linux) with
**≥ 4 GB RAM** assigned to Docker (6 GB is comfortable), **~15 GB of free disk** (images ~7 GB + build cache ~6 GB), `git`,
`make`, `curl`. Windows: clone and run everything **inside** a WSL2 terminal — see
[docs/windows-wsl2.md](docs/windows-wsl2.md).

```sh
git clone https://github.com/fredpalas/otel-incident-lab.git
cd otel-incident-lab
make doctor   # checks Docker, RAM, ports
make pull     # downloads and builds everything; afterwards no network is needed
make up       # starts the stack
```

Open Grafana at <http://localhost:3000>. If it loads, you're ready. `make down`
until the workshop.

**Plan B — GitHub Codespaces.** If your laptop can't run it, open the repo in a
codespace (Code → Codespaces → *Create codespace*, 4-core machine). The devcontainer
runs `make pull` and `make up` for you; Grafana opens on the forwarded port 3000.
It needs network, so do it before the session too.

## During the workshop

```sh
make lab N=1      # jump to the start of lab 1 (your current work is saved first)
make verify N=1   # tells you whether you're done
make where        # which lab / branch / changed files
make solution N=1 # stuck? jump to the solution (your work is saved first)
make help         # everything else
```

Labs live in [`labs/`](labs/). Each one starts with a support ticket or an alert.

`make lab` and `make solution` never throw your work away: uncommitted changes are
committed on your current branch first, and you get a fresh branch (`my/lab-N`) from
the lab's checkpoint. The command prints how to get back to where you were.

## About AI assistants

**Labs 1–4: your eyes and Grafana. Lab 5: your agent and the same Grafana.**

Labs 1–4 build the debugging muscle: reading logs, traces and dashboards yourself.
Lab 5 replays an investigation with an AI agent connected to Grafana over MCP — and
it only works as well as the telemetry you built in labs 1–4.

So this repo ships a **coach mode** for AI agents (Claude Code, Copilot, Cursor,
Codex, Gemini, opencode…), driven by [`AGENTS.md`](AGENTS.md) and the active lab in
`.lab-state` (Claude Code also gets hooks; opencode gets the permissions in
`opencode.json`, unlocked on the lab 5 checkpoint). During labs 1–4 your agent will explain concepts, help with Docker or
environment problems (always fair game!), and give hints — but it won't write the
fix or read the solutions for you. From lab 5 it becomes a full agent.

It's an **honor system**, not DRM: you can bypass it. We'd just ask you not to —
lab 5 is a lot more interesting if you did 1–4 yourself.
