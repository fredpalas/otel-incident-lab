// Lab 2 — Traces (D2 origin + log/trace correlation, D3 timeouts/retries/idempotency).
// Every checkout carries a traceparent we chose, so each check reads exactly the trace
// of its own request from Tempo (ADR-0008). Faults are forced through Toxiproxy (ADR-0007).
import { type Check, fail, pass, poll, runId, sleep } from './lib/check.ts';
import { type LogLine, queryLogs } from './lib/loki.ts';
import { deepestErrorSpan, getTrace, type Span } from './lib/tempo.ts';
import { type CheckoutResult, tracedCheckouts } from './lib/traffic.ts';
import { type Toxic, withToxics } from './lib/toxiproxy.ts';

const run = runId();
const startedAt = Date.now();

const RESET_EVERY_CALL: Toxic[] = [
  { name: 'verify_reset', type: 'reset_peer', stream: 'downstream', toxicity: 1, attributes: { timeout: 0 } },
];
// Slow but healthy: every PSP answer takes 300 ms more than usual (~350–400 ms in total
// for 90 % of calls) — well inside what a payment provider normally takes.
const SLOW_PSP: Toxic[] = [
  { name: 'verify_latency', type: 'latency', stream: 'downstream', toxicity: 1, attributes: { latency: 300, jitter: 0 } },
];

const once = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  let value: Promise<T> | undefined;
  return () => (value ??= fn());
};

const resetRun = once(() => withToxics('psp', RESET_EVERY_CALL, () => tracedCheckouts(`verify-${run}-reset`, 3)));
const slowRun = once(async () => {
  const results = await withToxics('psp', SLOW_PSP, () => tracedCheckouts(`verify-${run}-slow`, 5));
  // Give abandoned retries (if any) time to finish so their spans are in the trace.
  await sleep(2_000);
  return results;
});

// Once a first run found no trace at all, later waits are pointless: keep verify < 60 s.
let tracingMissing = false;
const waitMs = (full: number): number => (tracingMissing ? 4_000 : full);

// Each service exports its spans in its own batch (every few seconds), so a trace is
// only complete once all three services have reported.
const SERVICES = ['gateway', 'orders', 'payments'];
const complete = (spans: Span[] | undefined): boolean =>
  Boolean(spans) && SERVICES.every((svc) => spans?.some((s) => s.service === svc));

/** Traces of a run, keyed by trace id. Missing traces stay undefined after the timeout. */
async function tracesOf(results: CheckoutResult[]): Promise<Map<string, Span[] | undefined>> {
  const ids = results.map((r) => r.traceId).filter((id): id is string => Boolean(id));
  const found = new Map<string, Span[] | undefined>();
  await poll(
    async () => {
      for (const id of ids) {
        if (!complete(found.get(id))) found.set(id, (await getTrace(id).catch(() => undefined)) ?? found.get(id));
      }
      return ids.every((id) => complete(found.get(id))) ? true : undefined;
    },
    { timeoutMs: waitMs(25_000), intervalMs: 2_000 },
  );
  if (ids.every((id) => !found.get(id))) tracingMissing = true;
  // Spans arrive in batches per service; one more read picks up the late ones.
  for (const id of ids) if (found.get(id)) found.set(id, await getTrace(id).catch(() => found.get(id)));
  return found;
}

const resetTraces = once(async () => tracesOf(await resetRun()));
const slowTraces = once(async () => tracesOf(await slowRun()));

const NO_TRACES =
  'Tempo has no trace for our checkout. Is the OpenTelemetry SDK loaded in every service (src/instrumentation.ts via node --import) and does the Collector have a traces pipeline?';

const pspCalls = (spans: Span[]): Span[] =>
  spans.filter((s) => s.service === 'payments' && s.kind === 'client' && /charges/.test(String(s.attributes['url.full'] ?? s.name)));

const errorLogs = once(async (): Promise<LogLine[]> => {
  await resetTraces();
  const ids = (await resetRun()).map((r) => r.traceId).join('|');
  const logql = `{service_name=~"gateway|orders|payments"} | severity_text=~"(?i)error" | trace_id=~"${ids}"`;
  return (
    (await poll(
      async () => {
        const lines = await queryLogs(logql, startedAt);
        const services = new Set(lines.map((l) => l.labels.service_name));
        return services.size === 3 ? lines : undefined;
      },
      { timeoutMs: waitMs(20_000), intervalMs: 2_000 },
    )) ?? (await queryLogs(logql, startedAt))
  );
});

export const checks: Check[] = [
  {
    id: 'deepest-error-span',
    description: 'Tempo shows where the failure starts: the deepest error span is payments calling the PSP',
    run: async () => {
      const traces = [...(await resetTraces()).values()];
      if (traces.every((t) => !t)) return fail(NO_TRACES);
      const origins = traces.map((t) => (t ? deepestErrorSpan(t) : undefined));
      const ok = origins.filter((s) => s?.service === 'payments' && s.kind === 'client').length;
      if (ok === traces.length) return pass(`deepest error span: ${origins[0]?.service} → "${origins[0]?.name}"`);
      const seen = [...new Set(origins.map((s) => (s ? `${s.service} (${s.kind})` : 'no error span')))].join(', ');
      return fail(
        `Deepest error span found in: ${seen}. A trace should cover gateway → orders → payments → PSP. Are all three services instrumented, and is the trace context propagated on outgoing HTTP calls?`,
      );
    },
  },
  {
    id: 'logs-carry-trace-id',
    description: 'Error logs of gateway, orders and payments carry the trace_id of their request',
    run: async () => {
      const services = new Set((await errorLogs()).map((l) => l.labels.service_name));
      const missing = ['gateway', 'orders', 'payments'].filter((s) => !services.has(s));
      return missing.length === 0
        ? pass('log → trace links work for all three services')
        : fail(
            `No error log with the request's trace_id from: ${missing.join(', ')}. With the SDK running, the pino instrumentation adds trace_id/span_id to every log line — is it enabled in those services?`,
          );
    },
  },
  {
    id: 'origin-logs-the-stack',
    description: 'Only the origin (payments) logs the full error; upstream hops log a short line',
    run: async () => {
      const lines = await errorLogs();
      if (lines.length === 0) return fail('No error logs correlated to our traces yet — fix the previous check first.');
      const withStack = (service: string): number =>
        lines.filter((l) => l.labels.service_name === service && l.labels.err_stack).length;
      const noisy = ['gateway', 'orders'].filter((s) => withStack(s) > 0);
      if (noisy.length > 0) {
        return fail(
          `${noisy.join(' and ')} still log the full error with its stack trace for a failure that started in payments. Keep the full error at the origin; upstream, log one short line (what failed, which order) — the trace links them.`,
        );
      }
      return withStack('payments') > 0
        ? pass('stack trace only at the origin')
        : fail('payments should keep logging the full error (with err) — it is where the failure starts.');
    },
  },
  {
    id: 'slow-psp-still-works',
    description: 'Checkouts succeed when the PSP is slow but healthy (~400 ms)',
    run: async () => {
      const results = await slowRun();
      const ok = results.filter((r) => r.status === 201).length;
      return ok >= 2
        ? pass(`${ok}/${results.length} checkouts succeeded`)
        : fail(
            `${ok}/${results.length} checkouts succeeded while the PSP answered in ~400 ms. Look at the timeouts along the chain gateway → orders → payments → PSP: is each one sized for what the next hop really takes (think p99, not average)?`,
          );
    },
  },
  {
    id: 'no-retry-storm',
    description: 'No retry storm: at most 2 PSP calls per checkout',
    run: async () => {
      const traces = [...(await slowTraces()).values()].filter((t): t is Span[] => Boolean(t));
      if (traces.length === 0) return fail(NO_TRACES);
      const counts = traces.map((t) => pspCalls(t).length);
      const max = Math.max(...counts);
      if (max === 0) return fail('The traces have no payments → PSP client span. Is payments instrumented (outgoing fetch calls)?');
      return max <= 2
        ? pass(`PSP calls per checkout: ${counts.join(', ')}`)
        : fail(
            `Up to ${max} PSP calls for a single checkout (${counts.join(', ')}). Open one of these traces: what do the repeated sibling spans to the PSP tell you? When is a retry safe, and how long should payments wait before it?`,
          );
    },
  },
  {
    id: 'idempotency-key',
    description: 'Charges sent to the PSP carry an Idempotency-Key',
    run: async () => {
      const traces = [...(await slowTraces()).values()].filter((t): t is Span[] => Boolean(t));
      if (traces.length === 0) return fail(NO_TRACES);
      const pspSpans = traces.flat().filter((s) => s.service === 'fake-psp');
      if (pspSpans.length === 0) return fail('No fake-psp spans in our traces — is the traceparent header sent on the call to the PSP?');
      const keyed = pspSpans.filter((s) => String(s.attributes['psp.idempotency_key'] ?? '') !== '').length;
      return keyed === pspSpans.length
        ? pass(`${keyed} charge request(s), all with an Idempotency-Key`)
        : fail(
            `${pspSpans.length - keyed}/${pspSpans.length} charge requests reached the PSP without an Idempotency-Key. If payments times out and retries, how does the PSP know it's the same payment and not a second one?`,
          );
    },
  },
];
