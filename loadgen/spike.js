// A flash sale: tickets for a popular show go on sale and everybody clicks at once.
import http from 'k6/http';
import { check } from 'k6';

const GATEWAY = __ENV.GATEWAY_URL || 'http://gateway:8080';

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2s', target: 150 },
        { duration: '20s', target: 150 },
        { duration: '5s', target: 0 },
      ],
    },
  },
};

export default function () {
  const res = http.post(
    `${GATEWAY}/checkout`,
    JSON.stringify({ customerId: `cus_${1 + Math.floor(Math.random() * 500)}`, eventId: 'evt_1', tickets: 1 + Math.floor(Math.random() * 6) }),
    { headers: { 'content-type': 'application/json' }, tags: { name: 'POST /checkout' } },
  );
  check(res, { 'checkout accepted': (r) => r.status === 201 });
}
