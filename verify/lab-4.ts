// Lab 4 — Follow the order (D7 group bookings, D8 context across the queue, correlation_id
// in Baggage, no Baggage to the PSP, code.* attributes). One traced checkout is followed
// from the gateway to notifier, through the outbox and RabbitMQ (ADR-0008, ADR-0011).
import { type Check, fail, pass, poll, runId } from './lib/check.ts';
import { queryLogs } from './lib/loki.ts';
import { getTrace, searchTraces, type Span, waitForTraces } from './lib/tempo.ts';
import { checkout, newTraceId } from './lib/traffic.ts';
import { withToxics } from './lib/toxiproxy.ts';

const run = runId();
const startedAt = Date.now();

const once = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  let value: Promise<T> | undefined;
  return () => (value ??= fn());
};

// No connection resets for these: a group booking must fail only because of our code.
const groupRun = once(() =>
  withToxics('psp', [], () =>
    Promise.all([7, 8, 9, 10, 7].map((tickets) => checkout(`verify-${run}-group`, { tickets }))),
  ),
);

const followed = once(async () => {
  const traceId = newTraceId();
  const result = await withToxics('psp', [], () => checkout(`verify-${run}-follow`, { tickets: 2, traceId }));
  const orderId = (result.body as { id?: string } | undefined)?.id;
  const traces = await waitForTraces([traceId], ['gateway', 'orders', 'inventory', 'catalog', 'payments', 'fake-psp'], 25_000);
  return { traceId, orderId, spans: traces.get(traceId) ?? [] };
});

const NO_TRACE = 'Tempo has no trace for our checkout. Tracing from labs 2–3 must still work.';

const correlationOf = (spans: Span[]): string | undefined => {
  const gateway = spans.find((s) => s.service === 'gateway' && s.kind === 'server');
  const value = gateway?.attributes['correlation_id'];
  return value === undefined || value === '' ? undefined : String(value);
};

const HOPS = ['gateway', 'orders', 'inventory', 'catalog', 'payments'];

/** The notifier trace(s) of our order, found by its correlation_id. */
const notifierSpans = once(async (): Promise<Span[]> => {
  const { spans } = await followed();
  const cid = correlationOf(spans);
  if (!cid) return [];
  const traceql = `{ resource.service.name = "notifier" && span.correlation_id = "${cid}" }`;
  const found = await poll(
    async () => {
      const traces = await searchTraces(traceql, startedAt - 60_000);
      return traces && traces.length > 0 ? traces : undefined;
    },
    // Tempo only finds a trace by search once it stops receiving spans for it (~10–20 s).
    { timeoutMs: 45_000, intervalMs: 3_000 },
  );
  const all: Span[] = [];
  for (const t of found ?? []) all.push(...((await getTrace(t.traceID)) ?? []).filter((s) => s.service === 'notifier'));
  return all;
});

export const checks: Check[] = [
  {
    id: 'group-bookings',
    description: 'Group bookings (7–10 tickets) can be paid',
    run: async () => {
      const results = await groupRun();
      const ok = results.filter((r) => r.status === 201).length;
      return ok >= 4
        ? pass(`${ok}/${results.length} group checkouts confirmed`)
        : fail(
            `${ok}/${results.length} checkouts of 7–10 tickets succeeded. Which orders fail? Add the order's business attributes to its span and ask Tempo: { status = error && span.order.tickets > 6 }.`,
          );
    },
  },
  {
    id: 'business-attributes',
    description: "The checkout span in orders carries the order's business attributes",
    run: async () => {
      const { spans, orderId } = await followed();
      if (spans.length === 0) return fail(NO_TRACE);
      const span = spans.find(
        (s) =>
          s.service === 'orders' &&
          s.attributes['order.id'] === orderId &&
          s.attributes['order.tickets'] !== undefined &&
          s.attributes['customer.tier'] !== undefined,
      );
      return span
        ? pass(`"${span.name}": order.id, order.tickets=${span.attributes['order.tickets']}, customer.tier=${span.attributes['customer.tier']}`)
        : fail(
            'No span in orders has order.id (= the id returned to the customer), order.tickets and customer.tier. Without them you cannot ask Tempo which orders fail.',
          );
    },
  },
  {
    id: 'correlation-everywhere',
    description: 'Every hop of the checkout carries the same correlation_id',
    run: async () => {
      const { spans } = await followed();
      if (spans.length === 0) return fail(NO_TRACE);
      const cid = correlationOf(spans);
      if (!cid) {
        return fail(
          "The gateway's server span has no correlation_id. Create one per request in gateway, put it in the Baggage, and let a BaggageSpanProcessor copy it onto every span.",
        );
      }
      const missing = HOPS.filter((svc) => spans.some((s) => s.service === svc && s.kind === 'server' && s.attributes['correlation_id'] !== cid));
      return missing.length === 0
        ? pass(`correlation_id ${cid} on every server span`)
        : fail(
            `The server spans of ${missing.join(', ')} don't carry correlation_id ${cid}. Baggage travels with the W3C baggage header — does every service copy it onto its spans?`,
          );
    },
  },
  {
    id: 'no-baggage-leak',
    description: 'The correlation_id does not leak to the third-party PSP',
    run: async () => {
      const { spans } = await followed();
      const cid = correlationOf(spans);
      if (!cid) return fail('Nothing to check yet: there is no correlation_id (see the previous check).');
      const psp = spans.filter((s) => s.service === 'fake-psp');
      if (psp.length === 0) return fail('No fake-psp span in our trace — is the PSP call still traced?');
      const leaked = psp.filter((s) => Object.entries(s.attributes).some(([k, v]) => k === 'correlation_id' || v === cid));
      return leaked.length === 0
        ? pass('the PSP received no Baggage')
        : fail(
            "fake-psp received our correlation_id: Baggage is sent on every outgoing request, including to third parties (look at the PSP's span attributes). Strip it on the call to the PSP.",
          );
    },
  },
  {
    id: 'order-across-queue',
    description: 'notifier work is linked to the checkout and carries its correlation_id',
    run: async () => {
      const { spans, traceId } = await followed();
      const cid = correlationOf(spans);
      if (!cid) return fail('No correlation_id to follow yet (see the correlation check).');
      const notifier = await notifierSpans();
      if (notifier.length === 0) {
        return fail(
          `No notifier span carries correlation_id ${cid}. order.paid goes through the outbox and RabbitMQ: what does the event envelope carry, and what does notifier do with it?`,
        );
      }
      if (!notifier.some((s) => s.links.includes(traceId))) {
        return fail(
          "notifier spans have the correlation_id but no link to the checkout's trace. Carry the trace context in the envelope (traceparent) and start notifier's span with a link to it.",
        );
      }
      const logs = await poll(
        async () => {
          const lines = await queryLogs(`{service_name="notifier"} | correlation_id="${cid}"`, startedAt - 60_000);
          return lines.length > 0 ? lines : undefined;
        },
        { timeoutMs: 10_000, intervalMs: 2_000 },
      );
      return logs
        ? pass(`notifier span linked to the checkout trace, ${logs.length} notifier log line(s) with the correlation_id`)
        : fail("notifier's spans are linked, but its logs don't carry correlation_id. Add it to every log line (pino mixin).");
    },
  },
  {
    id: 'code-attributes',
    description: 'Manual spans in orders say which code they run (code.function.name, code.file.path)',
    run: async () => {
      const { spans } = await followed();
      if (spans.length === 0) return fail(NO_TRACE);
      const span = spans.find((s) => s.service === 'orders' && s.attributes['code.function.name'] && s.attributes['code.file.path']);
      return span
        ? pass(`${span.attributes['code.function.name']} in ${span.attributes['code.file.path']}`)
        : fail('No span in orders has code.function.name and code.file.path. An agent (lab 5) uses them to go from a trace to the code.');
    },
  },
];
