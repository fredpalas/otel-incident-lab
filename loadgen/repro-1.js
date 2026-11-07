// Lab 1 repro: what the support ticket describes. Places checkouts, then looks at the orders again.
import http from 'k6/http';
import { sleep } from 'k6';

const GATEWAY = __ENV.GATEWAY_URL || 'http://gateway:8080';
const CHECKOUTS = 60;

export const options = { vus: 1, iterations: 1, summaryTrendStats: [] };

export default function () {
  const confirmed = [];
  for (let i = 0; i < CHECKOUTS; i++) {
    const res = http.post(
      `${GATEWAY}/checkout`,
      JSON.stringify({ customerId: `cus_repro_${i}`, eventId: 'evt_1', tickets: 2 }),
      { headers: { 'content-type': 'application/json' } },
    );
    if (res.status === 201) confirmed.push(res.json('id'));
  }

  console.log(`${confirmed.length}/${CHECKOUTS} checkouts said "Order confirmed" (201). Waiting 5 s…`);
  sleep(5);

  const byStatus = {};
  const stuck = [];
  for (const id of confirmed) {
    const status = http.get(`${GATEWAY}/orders/${id}`).json('status');
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (status === 'PENDING') stuck.push(id);
  }

  console.log(`Order status of the confirmed checkouts: ${JSON.stringify(byStatus)}`);
  if (stuck.length > 0) {
    console.log(`Confirmed but never paid — e.g. GET /orders/${stuck[0]}`);
  }
}
