import type { Check } from './lib/check.ts';

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

console.log(`\nVerifying lab ${lab}\n`);
let failed = 0;
for (const check of checks) {
  const started = Date.now();
  const result = await check.run().catch((err: unknown) => ({
    ok: false as const,
    hint: `check crashed: ${(err as Error).message}`,
  }));
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (result.ok) {
    console.log(`✅ ${check.description}${result.detail ? ` — ${result.detail}` : ''} (${secs}s)`);
  } else {
    failed++;
    console.log(`❌ ${check.description} (${secs}s)\n   💡 ${result.hint}`);
  }
}

console.log(failed === 0 ? `\n🎉 Lab ${lab}: all checks passed.\n` : `\n${failed} check(s) failed.\n`);
process.exit(failed === 0 ? 0 : 1);
