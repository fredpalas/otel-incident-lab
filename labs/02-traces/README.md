# Lab 2 — Traces (45')

```sh
make lab N=2      # checkout lab-2-start, apply scenario, restart affected services
make verify N=2   # tells you if you're done
```

## 🎫 Support ticket #4718 (follow-up of #4711)

> "Thanks for the fix — customers now see an error instead of a fake confirmation.
> But: **some were charged twice**, and a few were **charged although the site said the
> payment failed**. Finance has the PSP statement to prove it. Oh, and sometimes checkout
> just fails."

Lab 1 left you with a question: `gateway`, `orders` and `payments` all log an error for
the same failed checkout. **Where does it start?** Logs can't tell you. Traces can.

## Goal

1. Find the **origin** of the failures, and make each error log link to its trace.
2. Find out how customers get charged twice, and stop it.

You're done when `make verify N=2` is all ✅.

## Steps

1. **Instrument the services.** Add OpenTelemetry tracing to `gateway`, `orders`,
   `inventory`, `catalog`, `payments` and `notifier` with the Node SDK and the zero-code auto-instrumentations:
   - one file per service, `src/instrumentation.ts`, that starts the SDK;
   - loaded **before** the app with `node --import ./dist/instrumentation.js dist/main.js`
     (see each service's `Dockerfile`);
   - the packages (`@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`)
     are already installed. Configuration comes from the `OTEL_*` env vars, already set.
   - Do `orders` first, check it works, then copy the same file to `payments` and
     `gateway` (enough for this lab). `inventory`, `catalog` and `notifier` if you have
     time — lab 3 starts with all six instrumented anyway.
2. **Let traces through the Collector.** `observability/collector/config.yaml` only has a
   `logs` pipeline. Add a `traces` one.
3. **Follow an error.** `make repro N=2`, then in Grafana → Explore → Loki, open an error
   line from `orders`. Is there a link to its trace? (Hint: the pino instrumentation adds
   `trace_id` to every log line once the SDK runs.) Open the trace. Which span is the
   **deepest one with an error**? That's the origin. What kind of error is it? Is it our
   code?
4. **Stop the noise.** Three services log the same failure with three stack traces. Keep
   the full error where it starts; upstream, a short line is enough — the trace links them.
5. **Charged twice.** Open the trace of a slow checkout (Tempo → Search, sort by
   duration, or TraceQL `{ resource.service.name = "payments" && kind = client }`). Look
   at the calls from `payments` to the PSP. How many are there? Compare their duration
   with the PSP's own span. Then read the timeouts and retries of each hop in
   `docker-compose.yml` and `services/payments/src/payments/infrastructure/psp/`.
   - Is each timeout sized for what the next hop *really* takes (p99, not average)?
   - Is each hop's total time (retries included) shorter than the timeout of its caller?
   - Which errors are safe to retry? How does the PSP know a retry is the same payment?
     (It supports the `Idempotency-Key` header.)

## What you should see in Grafana

- **Explore → Tempo → Search**: one trace per checkout, across `gateway → orders →
  inventory / catalog / payments → fake-psp`.
- A failed checkout's trace: errors on several spans, and one deepest error span.
- A slow checkout's trace before the fix: several sibling `POST` spans from `payments` to
  the PSP, and PSP spans that keep going after `payments` gave up.

## Hints

<details>
<summary>Hint 1 — <code>src/instrumentation.ts</code></summary>

```ts
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();

process.on('SIGTERM', () => {
  void sdk.shutdown();
});
```

Then change the `CMD` of the service's `Dockerfile` so `node` loads it first with
`--import`, and `make up`. Logs already go to Loki through the pino transport — check the
options of `@opentelemetry/instrumentation-pino` so the SDK doesn't send them a second time.

</details>

<details>
<summary>Hint 2 — Traces don't show up in Tempo</summary>

- `docker compose logs otel-collector`: errors? Does the `traces` pipeline exist?
- `docker compose logs orders`: any OTLP export errors (404 means the Collector has no
  pipeline for that signal)?
- Is `node --import ./dist/instrumentation.js` really in the command that starts the
  container (`docker compose ps --no-trunc`)?

</details>

<details>
<summary>Hint 3 — The origin</summary>

The deepest error span is the call from `payments` to the PSP, and its error is a
connection reset (`ECONNRESET`). Nothing in our code resets connections — something
between us and the PSP does. Not our bug to fix, but our system must cope with it.

</details>

<details>
<summary>Hint 4 — The timeouts</summary>

The PSP answers in < 100 ms most of the time, in 300–600 ms for ~8 % of requests and
in 1.5–3 s for ~2 %. A 300 ms timeout cuts 1 request in 10 — and every cut request was
still charged by the PSP. With 3 retries, `payments` can take 1.2 s, but `orders` gives up
after 1 s: the order is marked `FAILED` while `payments` keeps retrying… and charging.

</details>

Stuck? `make solution N=2` jumps to the solution (your work is saved first).
