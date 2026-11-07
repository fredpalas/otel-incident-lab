import type { Check } from './lib/check.ts';
import { restoreScenario, withToxics } from './lib/toxiproxy.ts';
import { checkouts } from './lib/traffic.ts';

const lab = process.argv[2];
if (!lab || !/^\d+$/.test(lab)) {
  console.error('usage: verify <lab-number>');
  process.exit(2);
}

let checks: Check[];
try {
  ({ checks } = (await import(`./lab-${lab}.ts`)) as { checks: Check[] });
} catch (err) {
  console.error(`No verify script for lab ${lab}: ${(err as Error).message}`);
  process.exit(2);
}

// Node is PID 1 in the container, where SIGINT and SIGTERM are ignored unless handled.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    console.log('\n\n⏹  interrupted, putting the lab scenario back…');
    void restoreScenario().finally(() => process.exit(130));
  });
}

// Right after `make up` the services are cold (on a small CI runner, some are still
// starting): a couple of throwaway checkouts first, so checks measure the code, not that.
if (lab !== '0') {
  await withToxics('psp', [], async () => {
    for (let round = 0; round < 2; round++) await checkouts('verify-warmup', 5);
  }).catch(() => undefined);
}

// Some checks wait for telemetry to be ingested (up to 30 s): show what is running.
const showRunning = (description: string): void => {
  if (process.stdout.isTTY) process.stdout.write(`⏳ ${description}…`);
};
const clearRunning = (): void => {
  if (process.stdout.isTTY) process.stdout.write('\r\x1b[2K');
};

console.log(`\nVerifying lab ${lab}\n`);
let failed = 0;
for (const check of checks) {
  const started = Date.now();
  showRunning(check.description);
  const result = await check.run().catch((err: unknown) => ({
    ok: false as const,
    hint: `check crashed: ${(err as Error).message}`,
  }));
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  clearRunning();
  if (result.ok) {
    console.log(`✅ ${check.description}${result.detail ? ` — ${result.detail}` : ''} (${secs}s)`);
  } else {
    failed++;
    console.log(`❌ ${check.description} (${secs}s)\n   💡 ${result.hint}`);
  }
}

console.log(failed === 0 ? `\n🎉 Lab ${lab}: all checks passed.\n` : `\n${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
