// Lab 5: a few loyal customers check out. Prints the error reference (X-Correlation-Id)
// of the checkouts that failed, as a customer would read it from the error page.
import http from 'k6/http';

const GATEWAY = __ENV.GATEWAY_URL || 'http://gateway:8080';

export const options = { vus: 1, iterations: 20 };

export default function () {
  const customerId = `cus_${__ITER % 2 === 0 ? 10 * (__ITER + 1) : 10 * __ITER + 3}`;
  const res = http.post(
    `${GATEWAY}/checkout`,
    JSON.stringify({ customerId, eventId: 'evt_1', tickets: 2 }),
    { headers: { 'content-type': 'application/json' } },
  );
  if (res.status >= 400) console.log(`checkout failed: customer ${customerId}, HTTP ${res.status}, error reference ${res.headers['X-Correlation-Id']}`);
}
