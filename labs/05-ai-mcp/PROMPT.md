# Lab 5 — Prompt for the agent

Get an error reference first: `make repro N=5` prints a few failed checkouts with the
reference the customer saw. Paste one below, then give the agent the whole message.

---

> Support ticket #5120 — "I tried to buy tickets twice today and both times checkout
> failed. My customer id is `<customer>`; the error page said reference `<reference>`."
>
> Investigate using Grafana (logs, traces, metrics) through the `grafana` MCP server.
> Find the root cause in this repository, propose a minimal fix, and tell me how you
> will verify it. Don't change anything until I approve.

---

After approval:

> Approved. Apply the fix, rebuild what you changed (`make up`), then verify it:
> `make verify N=5`, and check the checkout error rate in Prometheus.
