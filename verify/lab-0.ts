// Lab 0 is not a workshop lab: it is the stack smoke test used by `make doctor` and CI.
import { type Check, fail, pass } from './lib/check.ts';
import { env } from './lib/env.ts';
import { isUp } from './lib/http.ts';
import { withDb } from './lib/db.ts';
import { listToxics } from './lib/toxiproxy.ts';

const ready = (id: string, description: string, url: string): Check => ({
  id,
  description,
  run: async () => ((await isUp(url)) ? pass() : fail(`${url} is not ready. Try: make up, then wait ~30 s.`)),
});

export const checks: Check[] = [
  ready('loki', 'Loki is ready', `${env.lokiUrl}/ready`),
  ready('tempo', 'Tempo is ready', `${env.tempoUrl}/ready`),
  ready('prometheus', 'Prometheus is ready', `${env.prometheusUrl}/-/ready`),
  {
    id: 'postgres',
    description: 'Postgres accepts connections',
    run: async () => {
      await withDb((c) => c.query('SELECT 1'));
      return pass();
    },
  },
  {
    id: 'toxiproxy',
    description: 'Toxiproxy has the psp proxy',
    run: async () => {
      await listToxics('psp');
      return pass();
    },
  },
];
