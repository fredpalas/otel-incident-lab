// Lab 3 — Latency (D4 N+1, D5 sequential calls, D6 connections, span metrics for D10).
// Traffic first, then the checks read what it left behind: its own traces in Tempo
// (ADR-0008), the Collector's span metrics in Prometheus, inventory's errors in Loki.
import { type Check, fail, pass, poll, runId } from './lib/check.ts';
import { queryLogs } from './lib/loki.ts';
import { exemplarsSince, latestSampleMs } from './lib/prom.ts';
import { type Span, waitForTraces } from './lib/tempo.ts';
import { type CheckoutResult, checkout, newTraceId } from './lib/traffic.ts';

const run = runId();
const startedAt = Date.now();

const SPIKE_CHECKOUTS = 40;
const TRACED_CHECKOUTS = 5;
// The biggest order that is not a group booking (7+ tickets are lab 4's business).
const TICKETS = 6;

const once = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  let value: Promise<T> | undefined;
  return () => (value ??= fn());
};

/** A burst of simultaneous checkouts, like the first second of a flash sale. */
const spike = once(async () => {
  const from = Date.now();
  const results = await Promise.all(
    Array.from({ length: SPIKE_CHECKOUTS }, () => checkout(`verify-${run}-spike`, { tickets: 2 })),
  );
  return { from, results };
});

/** One checkout at a time, so any overlap between calls comes from the code, not from us. */
const traced = once(async (): Promise<CheckoutResult[]> => {
  await spike();
  const results: CheckoutResult[] = [];
  for (let i = 0; i < TRACED_CHECKOUTS; i++) {
    results.push(await checkout(`verify-${run}-trace`, { tickets: TICKETS, traceId: newTraceId() }));
  }
  return results;
});

const traces = once(async (): Promise<Span[][]> => {
  const ids = (await traced()).map((r) => r.traceId).filter((id): id is string => Boolean(id));
  const found = await waitForTraces(ids, ['gateway', 'orders', 'inventory', 'catalog'], 25_000);
  return [...found.values()].filter((t): t is Span[] => Boolean(t));
});

const NO_TRACES =
  "Tempo has no trace for our checkouts. Lab 2's tracing must still work: is the SDK loaded in every service, and the traces pipeline in the Collector?";

const isDb = (s: Span): boolean => (s.attributes['db.system.name'] ?? s.attributes['db.system']) === 'postgresql';
const queryText = (s: Span): string => String(s.attributes['db.query.text'] ?? s.attributes['db.statement'] ?? '');
const inventoryQueries = (t: Span[]): Span[] =>
  t.filter((s) => s.service === 'inventory' && isDb(s) && s.name.startsWith('pg.query') && !/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(queryText(s)));

const CHECKOUT_CALLS = [/\/reservations/, /\/pricing\//, /\/customers\//];
const checkoutCalls = (t: Span[]): Span[] =>
  t.filter((s) => s.service === 'orders' && s.kind === 'client' && CHECKOUT_CALLS.some((re) => re.test(String(s.attributes['url.full'] ?? ''))));

// Span metrics are flushed by the Collector every few seconds; once the first metric is
// missing, don't wait as long for the next one (keeps verify under a minute).
let metricsMissing = false;

export const checks: Check[] = [
  {
    id: 'n-plus-one',
    description: `inventory reserves ${TICKETS} seats with at most 3 database queries`,
    run: async () => {
      const all = await traces();
      if (all.length === 0) return fail(NO_TRACES);
      const counts = all.map((t) => inventoryQueries(t).length);
      const max = Math.max(...counts);
      if (max === 0) return fail('No database spans from inventory in our traces. Is inventory instrumented (pg)?');
      return max <= 3
        ? pass(`queries per reservation: ${counts.join(', ')}`)
        : fail(
            `Up to ${max} queries to reserve ${TICKETS} seats (${counts.join(', ')}). Open one of these traces and look at inventory's database spans: what pattern do you see, and what does db.query.text repeat?`,
          );
    },
  },
  {
    id: 'parallel-calls',
    description: 'orders calls inventory, pricing and customers in parallel',
    run: async () => {
      const all = await traces();
      if (all.length === 0) return fail(NO_TRACES);
      const ratios: number[] = [];
      for (const t of all) {
        const calls = checkoutCalls(t);
        if (calls.length < 3) continue;
        const envelope = Math.max(...calls.map((s) => s.endMs)) - Math.min(...calls.map((s) => s.startMs));
        const sum = calls.reduce((acc, s) => acc + (s.endMs - s.startMs), 0);
        ratios.push(envelope / sum);
      }
      if (ratios.length === 0) return fail('No trace has the three calls from orders (inventory, /pricing, /customers). Are all services instrumented?');
      // Sequential calls take at least the sum of their durations; parallel ones about the longest.
      const sequential = ratios.filter((r) => r > 0.8).length;
      return sequential === 0
        ? pass(`the three calls overlap in all ${ratios.length} traces`)
        : fail(
            `In ${sequential}/${ratios.length} traces the calls from orders to inventory, /pricing and /customers run one after another. Do they depend on each other?`,
          );
    },
  },
  {
    id: 'connection-reuse',
    description: 'inventory reuses database connections instead of opening one per request',
    run: async () => {
      const all = await traces();
      if (all.length === 0) return fail(NO_TRACES);
      const connecting = all.filter((t) => t.some((s) => s.service === 'inventory' && s.name === 'pg.connect')).length;
      return connecting <= 1
        ? pass(`${connecting}/${all.length} traces open a new connection`)
        : fail(
            `${connecting}/${all.length} inventory requests opened a brand-new database connection (a pg.connect span). What does that cost on every request, and what happens when 40 arrive at once?`,
          );
    },
  },
  {
    id: 'spike-no-too-many-clients',
    description: `A burst of ${SPIKE_CHECKOUTS} checkouts does not exhaust Postgres connections`,
    run: async () => {
      const { from, results } = await spike();
      const logql = `{service_name="inventory"} | err_message=~"(?i).*too many clients.*"`;
      // Give Loki time to ingest the errors, if any.
      const lines =
        (await poll(
          async () => {
            const found = await queryLogs(logql, from);
            return found.length > 0 ? found : undefined;
          },
          { timeoutMs: 8_000, intervalMs: 2_000 },
        )) ?? [];
      const ok = results.filter((r) => r.status === 201).length;
      return lines.length === 0
        ? pass(`${ok}/${results.length} checkouts confirmed, no "too many clients"`)
        : fail(
            `${lines.length} "sorry, too many clients already" errors in inventory during the burst (${ok}/${results.length} checkouts confirmed). Postgres accepts 20 connections: how many does inventory open, and for how long?`,
          );
    },
  },
  {
    id: 'spanmetrics-exemplars',
    description: 'The Collector derives latency histograms with exemplars from the spans',
    run: async () => {
      await traces();
      const selector = '{__name__=~"traces_span_metrics_duration.*_bucket", service_name="gateway"}';
      const fresh = await poll(async () => ((await latestSampleMs(selector)) ?? 0) >= startedAt || undefined, {
        timeoutMs: 30_000,
        intervalMs: 3_000,
      });
      if (!fresh) {
        metricsMissing = true;
        return fail(
          'Prometheus has no fresh span-metrics histogram for gateway. The Collector can turn spans into RED metrics with the spanmetrics connector: it is an exporter of the traces pipeline and a receiver of a metrics pipeline.',
        );
      }
      const exemplars = (await exemplarsSince(selector, startedAt)).flatMap((s) => s.exemplars).filter((e) => e.labels.trace_id);
      return exemplars.length > 0
        ? pass(`histogram present, ${exemplars.length} exemplar(s) linking to traces`)
        : fail('The latency histogram is there but has no exemplars. Without them, a p99 spike has no link to a trace: enable exemplars in the spanmetrics connector.');
    },
  },
  {
    id: 'service-graph',
    description: 'The Collector builds the service graph (orders → inventory edge)',
    run: async () => {
      await traces();
      const selector = '{__name__=~"traces_service_graph_request_total", client="orders", server="inventory"}';
      const fresh = await poll(async () => ((await latestSampleMs(selector)) ?? 0) >= startedAt || undefined, {
        timeoutMs: metricsMissing ? 3_000 : 30_000,
        intervalMs: 3_000,
      });
      return fresh
        ? pass('orders → inventory edge present')
        : fail('No service graph metrics for orders → inventory. The servicegraph connector builds them from client/server span pairs, like spanmetrics.');
    },
  },
];
