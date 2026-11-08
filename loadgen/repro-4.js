// Lab 4 repro: a busy afternoon with some group bookings. Prints the orders that failed.
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const GATEWAY = __ENV.GATEWAY_URL || 'http://gateway:8080';

const confirmed = new Counter('checkouts_confirmed');
const failed = new Counter('checkouts_failed');

export const options = {
  scenarios: { afternoon: { executor: 'shared-iterations', vus: 4, iterations: 100, maxDuration: '3m' } },
};

export default function () {
  const tickets = __ITER % 10 === 0 ? 7 + (__ITER % 4) : 1 + (__ITER % 4);
  const res = http.post(
    `${GATEWAY}/checkout`,
    JSON.stringify({ customerId: `cus_${1 + ((__VU * 37 + __ITER) % 500)}`, eventId: 'evt_1', tickets }),
    { headers: { 'content-type': 'application/json' } },
  );
  (res.status === 201 ? confirmed : failed).add(1);
}
