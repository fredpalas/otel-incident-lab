// Lab 5 — Agent + MCP and wrap-up (D9 PII in telemetry, incident-5 when it is live).
import { type Check, fail, pass } from './lib/check.ts';
import { type Span, waitForTraces } from './lib/tempo.ts';
import { checkout, newTraceId } from './lib/traffic.ts';
import { withToxics } from './lib/toxiproxy.ts';

const run = Date.now().toString(36);

const once = <T>(fn: () => Promise<T>): (() => Promise<T>) => {
  let value: Promise<T> | undefined;
  return () => (value ??= fn());
};

const EMAIL = /[^@\s"]+@[^@\s"]+\.[a-z]{2,}/i;

const pspSpans = once(async (): Promise<Span[]> => {
  const traceId = newTraceId();
  await withToxics('psp', [], () => checkout(`verify-${run}-pii`, { tickets: 1, traceId }));
  const traces = await waitForTraces([traceId], ['gateway', 'payments', 'fake-psp'], 25_000);
  return (traces.get(traceId) ?? []).filter((s) => s.service === 'fake-psp');
});

// Registered customers whose number ends in 0 are gold members.
const GOLD = ['cus_10', 'cus_20', 'cus_30', 'cus_40', 'cus_50'];

export const checks: Check[] = [
  {
    id: 'pii-redacted',
    description: 'No personal data (emails, card digits) is stored in Tempo',
    run: async () => {
      const spans = await pspSpans();
      if (spans.length === 0) return fail('No fake-psp span for our checkout in Tempo — is tracing still working end to end?');
      const leaks = new Set<string>();
      for (const span of spans) {
        for (const [key, value] of Object.entries(span.attributes)) {
          if (typeof value === 'string' && EMAIL.test(value)) leaks.add(key);
          if (key.startsWith('card.') && /\d{4}/.test(String(value))) leaks.add(key);
        }
      }
      return leaks.size === 0
        ? pass('no email address or card digits on the PSP spans')
        : fail(
            `fake-psp spans carry personal data in clear text: ${[...leaks].join(', ')}. You can't change a third party's instrumentation — but every span passes through your Collector.`,
          );
    },
  },
  {
    id: 'gold-checkouts',
    description: 'Gold loyalty members can check out',
    run: async () => {
      const results = await withToxics('psp', [], () =>
        Promise.all(GOLD.map((customer) => checkout(customer, { tickets: 2 }))),
      );
      const ok = results.filter((r) => r.status === 201).length;
      return ok >= GOLD.length - 1
        ? pass(`${ok}/${GOLD.length} gold checkouts confirmed`)
        : fail(`${ok}/${GOLD.length} checkouts by gold members succeeded. Start from one failed checkout's error reference.`);
    },
  },
];
