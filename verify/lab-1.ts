// Lab 1 — Silent failure (D1). Generates its own traffic tagged with a unique run id and
// forces PSP connection resets through Toxiproxy so the checks are deterministic (ADR-0007).
import { type Check, fail, pass, poll, runId, sleep } from './lib/check.ts';
import { withDb } from './lib/db.ts';
import { queryLogs } from './lib/loki.ts';
import { checkouts, type CheckoutResult } from './lib/traffic.ts';
import { type Toxic, withToxics } from './lib/toxiproxy.ts';

const run = runId();
const startedAt = Date.now();
const failingCustomer = `verify-${run}-fail`;
const healthyCustomer = `verify-${run}-ok`;

const RESET_EVERY_CALL: Toxic[] = [
  { name: 'verify_reset', type: 'reset_peer', stream: 'downstream', toxicity: 1, attributes: { timeout: 0 } },
];

interface Order {
  id: string;
  status: string;
}

const ordersOf = (customerId: string): Promise<Order[]> =>
  withDb(async (c) => (await c.query<Order>('SELECT id, status FROM orders WHERE customer_id = $1', [customerId])).rows);

// Traffic is generated once and shared by the checks below.
let failing: Promise<CheckoutResult[]> | undefined;
const failingRun = (): Promise<CheckoutResult[]> =>
  (failing ??= withToxics('psp', RESET_EVERY_CALL, async () => {
    const results = await checkouts(failingCustomer, 5);
    await sleep(500);
    return results;
  }));

let healthy: Promise<CheckoutResult[]> | undefined;
const healthyRun = (): Promise<CheckoutResult[]> => (healthy ??= withToxics('psp', [], () => checkouts(healthyCustomer, 5)));

export const checks: Check[] = [
  {
    id: 'happy-path',
    description: 'Checkouts still succeed when the payment provider is healthy',
    run: async () => {
      const results = await healthyRun();
      // From lab 2 on, the PSP's long tail (D10) may time out one charge: allow one miss.
      const created = results.filter((r) => r.status === 201).length;
      if (created < results.length - 1) {
        return fail(`Only ${created}/${results.length} healthy checkouts returned 201. Is the stack up (make up)? Did a change break the happy path?`);
      }
      const orders = await ordersOf(healthyCustomer);
      // notifier may already have moved a paid order on to NOTIFIED.
      const paid = orders.filter((o) => o.status === 'PAID' || o.status === 'NOTIFIED').length;
      return paid >= created
        ? pass(`${paid} orders PAID`)
        : fail(`Expected ${created} PAID orders, found ${paid}. Successful payments must still mark the order as PAID.`);
    },
  },
  {
    id: 'no-stuck-orders',
    description: 'A failed payment does not leave the order stuck in PENDING',
    run: async () => {
      await failingRun();
      const orders = await ordersOf(failingCustomer);
      if (orders.length === 0) return fail('No orders were created for the test customer. Is the stack up (make up)?');
      const pending = orders.filter((o) => o.status === 'PENDING').length;
      return pending === 0
        ? pass(`${orders.length} orders, none PENDING (${[...new Set(orders.map((o) => o.status))].join(', ')})`)
        : fail(`${pending}/${orders.length} orders stayed PENDING after the payment failed. What happens to the error coming back from payments?`);
    },
  },
  {
    id: 'customer-is-told',
    description: 'The customer is not told "Order confirmed" when the payment failed',
    run: async () => {
      const results = await failingRun();
      const confirmed = results.filter((r) => r.status >= 200 && r.status < 300).length;
      return confirmed === 0
        ? pass(`responses: ${[...new Set(results.map((r) => r.status))].join(', ')}`)
        : fail(`${confirmed}/${results.length} checkouts returned ${results[0]?.status} although the payment failed. Which status code should the API return when an upstream dependency fails?`);
    },
  },
  {
    id: 'error-logged',
    description: 'orders logs the payment failure to Loki, with the order id',
    run: async () => {
      await failingRun();
      const ids = (await ordersOf(failingCustomer)).map((o) => o.id);
      if (ids.length === 0) return fail('No orders were created for the test customer. Is the stack up (make up)?');
      const idRegex = ids.join('|');
      const logql =
        `{service_name="orders"} | severity_text=~"(?i)error"` +
        ` | order_id=~"${idRegex}" or orderId=~"${idRegex}"`;
      const lines = await poll(async () => {
        const found = await queryLogs(logql, startedAt);
        return found.length > 0 ? found : undefined;
      });
      if (lines) return pass(`${lines.length} error log line(s)`);

      const anyOrdersLogs = await queryLogs('{service_name="orders"}', startedAt, 1).catch(() => []);
      return anyOrdersLogs.length === 0
        ? fail('Loki has no logs at all from service "orders". Are its logs exported over OTLP to the Collector, and does the Collector have a logs pipeline?')
        : fail('orders sends logs, but none at level error carrying an order_id attribute for the failed orders. Log the failure as a structured error with the order id.');
    },
  },
];
