import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const HOOK = new URL('../deny-edits.mjs', import.meta.url).pathname;
const projects = [];

function project(lab) {
  const dir = mkdtempSync(join(tmpdir(), 'guard-'));
  projects.push(dir);
  if (lab !== undefined) writeFileSync(join(dir, '.lab-state'), `lab=${lab}\nmode=start\n`);
  return dir;
}
after(() => projects.forEach((d) => rmSync(d, { recursive: true, force: true })));

function decide({ lab, tool, input = {}, author = false }) {
  const dir = project(lab);
  const toolInput = { ...input };
  for (const key of ['file_path', 'notebook_path']) {
    if (toolInput[key]) toolInput[key] = join(dir, toolInput[key]); // Claude Code sends absolute paths
  }
  const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
  delete env.INCIDENT_LAB_AUTHOR;
  if (author) env.INCIDENT_LAB_AUTHOR = '1';
  const res = spawnSync('node', [HOOK], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: dir, tool_name: tool, tool_input: toolInput }),
    env,
    encoding: 'utf8',
  });
  assert.equal(res.status, 0, res.stderr);
  if (!res.stdout) return 'allow';
  const out = JSON.parse(res.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  assert.match(out.permissionDecisionReason, /hands-on without AI|lab 5 incident/);
  return out.permissionDecision;
}

const edit = (p) => ({ file_path: p });
const bash = (command) => ({ command });

const cases = [
  // docs/06 minimum table
  [2, 'Edit', edit('services/orders/src/checkout.ts'), 'deny'],
  [2, 'Edit', edit('README.md'), 'allow'],
  [2, 'Read', edit('labs/02-traces/SOLUTION.md'), 'deny'],
  [2, 'Read', edit('services/orders/src/checkout.ts'), 'allow'],
  [2, 'Bash', bash('make up'), 'allow'],
  [2, 'Bash', bash('docker compose logs orders'), 'allow'],
  [2, 'Bash', bash("sed -i 's/a/b/' services/orders/src/x.ts"), 'deny'],
  [2, 'Bash', bash('git diff lab-2-start lab-2-solution'), 'deny'],
  [2, 'Bash', bash('make solution N=2'), 'deny'],
  [2, 'mcp__grafana__query_loki_logs', {}, 'deny'],
  [5, 'Edit', edit('services/catalog/src/pricing.ts'), 'allow'],
  [undefined, 'Edit', edit('services/orders/src/x.ts'), 'deny'],
  // more edit/read paths
  [1, 'Write', edit('observability/collector/config.yaml'), 'deny'],
  [3, 'MultiEdit', edit('scenarios/lab-3.env'), 'deny'],
  [3, 'NotebookEdit', { notebook_path: 'services/x.ipynb' }, 'deny'],
  [3, 'Write', edit('notes/my-findings.md'), 'allow'],
  [3, 'Read', edit('docs/02-defects-catalog.md'), 'deny'],
  [3, 'Read', edit('docs/authoring/AUTHORING.md'), 'deny'],
  [4, 'Read', edit('scenarios/incident-5/patch.diff'), 'deny'],
  [3, 'Read', edit('labs/03-latency/README.md'), 'allow'],
  [3, 'Read', edit('docs/01-architecture.md'), 'allow'],
  [3, 'Grep', { pattern: 'fix', path: 'docs/authoring' }, 'deny'],
  // shell writes and peeks
  [2, 'Bash', bash('echo x > services/orders/src/x.ts'), 'deny'],
  [2, 'Bash', bash('echo x >> ./observability/collector/config.yaml'), 'deny'],
  [2, 'Bash', bash('cat fix.ts | tee services/orders/src/x.ts'), 'deny'],
  [2, 'Bash', bash('cp /tmp/fix.ts services/orders/src/x.ts'), 'deny'],
  [2, 'Bash', bash('git apply fix.patch'), 'deny'],
  [2, 'Bash', bash('patch -p1 < fix.patch'), 'deny'],
  [2, 'Bash', bash('git show lab-2-solution:services/orders/src/x.ts'), 'deny'],
  [2, 'Bash', bash('git checkout lab-2-solution'), 'deny'],
  [2, 'Bash', bash('git switch solution/lab-2'), 'deny'],
  [2, 'Bash', bash('cat labs/02-traces/SOLUTION.md'), 'deny'],
  [2, 'Bash', bash('head -50 docs/02-defects-catalog.md'), 'deny'],
  [2, 'Bash', bash('sh scripts/jump.sh solution 2'), 'deny'],
  // no false positives on everyday commands
  [2, 'Bash', bash('make verify N=2'), 'allow'],
  [2, 'Bash', bash('make lab N=2'), 'allow'],
  [2, 'Bash', bash('make doctor && make where'), 'allow'],
  [2, 'Bash', bash('docker compose ps'), 'allow'],
  [2, 'Bash', bash('docker compose up -d --build orders 2>&1 | tail -20'), 'allow'],
  [2, 'Bash', bash('docker stats --no-stream'), 'allow'],
  [2, 'Bash', bash('git status'), 'allow'],
  [2, 'Bash', bash('git diff'), 'allow'],
  [2, 'Bash', bash('git diff lab-2-start'), 'allow'],
  [2, 'Bash', bash('cat services/orders/src/checkout.ts'), 'allow'],
  [2, 'Bash', bash('grep -rn pino services/'), 'allow'],
  [2, 'Bash', bash('ls labs/02-traces'), 'allow'],
  [2, 'Bash', bash('pnpm install && pnpm test > /tmp/out.txt'), 'allow'],
  [2, 'Bash', bash('curl -s localhost:3000/api/health'), 'allow'],
  [2, 'mcp__ide__getDiagnostics', {}, 'allow'],
  [2, 'grafana-query_loki_logs', {}, 'deny'], // Copilot CLI's MCP tool naming
  [5, 'grafana-query_loki_logs', {}, 'allow'],
  [2, 'Edit', { path: 'services/orders/src/x.ts' }, 'deny'], // Copilot CLI passes path
  // lab 5 unlocks everything; author mode bypasses
  [5, 'Bash', bash("sed -i 's/a/b/' services/catalog/src/pricing.ts"), 'allow'],
  [5, 'mcp__grafana__search_dashboards', {}, 'allow'],
  // the lab 5 incident stays hidden from the agent, in lab 5 too
  [5, 'Read', edit('scenarios/incident-5/regression.patch'), 'deny'],
  [5, 'Bash', bash('cat scenarios/incident-5/regression.patch'), 'deny'],
  [5, 'Grep', { pattern: 'rate', path: 'scenarios/incident-5' }, 'deny'],
  [5, 'Bash', bash('git log -p -1'), 'allow'],
  [5, 'Read', edit('docs/02-defects-catalog.md'), 'deny'],
  [5, 'Read', edit('labs/05-ai-mcp/INSTRUCTOR.md'), 'deny'],
  [5, 'Bash', bash('cat labs/05-ai-mcp/SOLUTION.md'), 'deny'],
  [5, 'Read', edit('labs/05-ai-mcp/README.md'), 'allow'],
  [5, 'Read', edit('labs/04-follow-the-order/SOLUTION.md'), 'allow'],
  [5, 'Read', edit('services/orders/src/orders/domain/LoyaltyTier.ts'), 'allow'],
];

describe('deny-edits', () => {
  for (const [lab, tool, input, expected] of cases) {
    test(`lab ${lab ?? 'missing'} · ${tool} · ${input.command ?? input.file_path ?? input.notebook_path ?? input.path ?? '—'} → ${expected}`, () => {
      assert.equal(decide({ lab, tool, input }), expected);
    });
  }

  test('--copilot answers with a top-level decision and exit code 2', () => {
    const dir = project(2);
    const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
    delete env.INCIDENT_LAB_AUTHOR;
    const res = spawnSync('node', [HOOK, '--copilot'], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: dir, tool_name: 'Edit', tool_input: { path: join(dir, 'services/x.ts') } }),
      env,
      encoding: 'utf8',
    });
    assert.equal(res.status, 2);
    assert.equal(JSON.parse(res.stdout).permissionDecision, 'deny');
  });

  test('INCIDENT_LAB_AUTHOR=1 bypasses the guard', () => {
    assert.equal(decide({ lab: 2, tool: 'Edit', input: edit('services/orders/src/x.ts'), author: true }), 'allow');
  });
});
