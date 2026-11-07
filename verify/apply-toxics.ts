// Not a check: applies scenarios/lab-N.toxics.json to Toxiproxy (used by `make lab`).
import { existsSync, readFileSync } from 'node:fs';
import { replaceToxics, type Toxic } from './lib/toxiproxy.ts';

const n = process.argv[2];
const file = `/scenarios/lab-${n}.toxics.json`;
const byProxy = existsSync(file)
  ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, Toxic[]>)
  : {};

for (const proxy of ['psp']) {
  const toxics = byProxy[proxy] ?? [];
  await replaceToxics(proxy, toxics);
  console.log(`🧪 toxiproxy ${proxy}: ${toxics.length ? toxics.map((t) => t.name).join(', ') : 'no toxics'}`);
}
