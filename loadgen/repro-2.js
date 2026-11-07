// Lab 2 repro: a normal evening of checkouts. How many fail, and how long do they take?
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const GATEWAY = __ENV.GATEWAY_URL || 'http://gateway:8080';

const confirmed = new Counter('checkouts_confirmed');
const failed = new Counter('checkouts_failed');

export const options = {
  scenarios: { evening: { executor: 'shared-iterations', vus: 4, iterations: 40, maxDuration: '2m' } },
  summaryTrendStats: ['p(50)', 'p(99)', 'max'],
};

export default function () {
  const res = http.post(
    `${GATEWAY}/checkout`,
    JSON.stringify({ customerId: `cus_repro2_${__VU}_${__ITER}`, eventId: 'evt_1', tickets: 2 }),
    { headers: { 'content-type': 'application/json' } },
  );
  (res.status === 201 ? confirmed : failed).add(1);
  if (res.status !== 201) console.log(`checkout failed: ${res.status} after ${Math.round(res.timings.duration)} ms`);
}
