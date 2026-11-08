# Workshop entrypoints. Recipes stay POSIX sh so they work on macOS, Linux and WSL2.
SHELL := /bin/sh
COMPOSE := docker compose
TOOLS := $(COMPOSE) --profile tools

.DEFAULT_GOAL := help
.PHONY: help pull up down reset doctor load spike lab solution save where verify repro incident-5 mcp-token check-n

help: ## Show this help
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  make %-12s %s\n", $$1, $$2}'

pull: ## Pre-pull and build everything (run at home, before the workshop)
	$(COMPOSE) --profile tools --profile load --profile ai pull --ignore-buildable
	$(COMPOSE) --profile tools --profile load build

up: ## Start the stack (rebuilds what changed, restarts the Collector if its config changed)
	$(COMPOSE) up -d --build --wait
	@sh scripts/reload-collector.sh
	@echo "Grafana: http://localhost:3000"

down: ## Stop the stack (keeps data)
	$(COMPOSE) --profile load down

reset: ## Wipe all data and start clean
	$(COMPOSE) --profile load down -v
	$(MAKE) up

doctor: ## Check Docker, RAM, ports and images
	@sh scripts/doctor.sh

load: ## (Re)start baseline traffic
	$(COMPOSE) --profile load up -d --force-recreate loadgen

spike: ## Run a short load spike
	$(TOOLS) run --rm k6 run /scripts/spike.js

lab: check-n ## Jump to the start of lab N (your work is saved first): make lab N=2
	@sh scripts/jump.sh lab $(N)
	@sh scripts/apply-scenario.sh $(N)
	@$(MAKE) --no-print-directory up

solution: check-n ## Jump to the solution of lab N: make solution N=2
	@sh scripts/jump.sh solution $(N)
	@sh scripts/apply-scenario.sh $(N)
	@$(MAKE) --no-print-directory up

save: ## Commit your current work on your branch
	@git add -A && git commit -q --no-verify -m "wip: $$(date +%Y-%m-%dT%H:%M:%S)" && echo "💾 saved on $$(git branch --show-current)" || echo "nothing to save"

where: ## Show current lab, branch, changed files and scenario
	@sh scripts/where.sh

verify: check-n ## Check whether lab N is done: make verify N=1
	@$(TOOLS) run --rm --build -q verify $(N)

repro: check-n ## Reproduce the incident of lab N: make repro N=1
	$(TOOLS) run --rm k6 run /scripts/repro-$(N).js

incident-5: ## Lab 5 (instructor): legacy copy with the incident in ../ticketing-platform [BASE=main] [DIR=…]
	@sh scripts/incident-5.sh "$(or $(BASE),HEAD)" "$(or $(DIR),../ticketing-platform)"

mcp-token: ## Lab 5: create a Viewer token for the Grafana MCP server (.env.mcp)
	@sh scripts/mcp-token.sh

check-n:
	@case "$(N)" in ''|*[!0-9]*) echo "usage: make $(MAKECMDGOALS) N=<lab number>"; exit 2;; esac
