# WSL2 test checklist (for the author)

Run on a Windows laptop that has never had the repo. Copy the results back (one line
per step: ✅/❌ + time + anything odd).

## Environment

- [ ] `winver` → Windows version/build
- [ ] `wsl --version` → WSL, kernel
- [ ] Docker Desktop version, WSL2 backend on, integration with the distro on
- [ ] `.wslconfig` memory (and total laptop RAM)

## Setup (follow docs/windows-wsl2.md literally)

- [ ] `git clone` inside `~` → `make doctor` all ✅ (paste output)
- [ ] `make pull` → time, disk used (`docker system df`)
- [ ] `make up` → time to "Grafana:" line (target < 90 s), Grafana opens in the Windows browser
- [ ] `docker stats --no-stream` → total memory with `make load` running

## Offline

- [ ] Disconnect Wi-Fi. `make down && make up` → works
- [ ] `make lab N=2 && make verify N=2` (expect ❌) → `make solution N=2 && make verify N=2` (expect ✅)

## Labs

- [ ] `make verify N=1…5` on each `make solution N` → all ✅
- [ ] Edit a file under `services/` from VS Code (WSL extension), `make up` → the change is picked up
- [ ] `make lab N=5`, `make mcp-token`, Claude Code / Copilot in WSL can start the `grafana` MCP server

## Negative checks

- [ ] Clone once under `/mnt/c/…` → `make doctor` warns
- [ ] Clone once with Git for Windows (CRLF) and open in WSL → `make doctor` warns about line endings
