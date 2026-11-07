// Continuous background traffic: a few checkouts per second, like a quiet evening sale.
import http from 'k6/http';
import { sleep } from 'k6';

const GATEWAY = __ENV.GATEWAY_URL || 'http://gateway:8080';

export const options = {
  scenarios: {
    baseline: { executor: 'constant-arrival-rate', rate: 3, timeUnit: '1s', duration: '24h', preAllocatedVUs: 10 },
  },
};

export default function () {
  const r = Math.random();
  // Mostly couples and small groups; a few big group bookings.
  const tickets = r < 0.85 ? 1 + Math.floor(Math.random() * 4) : r < 0.97 ? 5 + Math.floor(Math.random() * 2) : 7 + Math.floor(Math.random() * 4);
  const res = http.post(
    `${GATEWAY}/checkout`,
    JSON.stringify({ customerId: `cus_${1 + Math.floor(Math.random() * 500)}`, eventId: 'evt_1', tickets }),
    { headers: { 'content-type': 'application/json' }, tags: { name: 'POST /checkout' } },
  );
  if (res.status === 201 && Math.random() < 0.3) {
    sleep(1);
    http.get(`${GATEWAY}/orders/${res.json('id')}`, { tags: { name: 'GET /orders/:id' } });
  }
}
