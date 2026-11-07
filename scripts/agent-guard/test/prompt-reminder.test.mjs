import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const HOOK = new URL('../prompt-reminder.mjs', import.meta.url).pathname;

function remind(lab, { author = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'guard-'));
  try {
    if (lab !== undefined) writeFileSync(join(dir, '.lab-state'), `lab=${lab}\n`);
    const env = { ...process.env, CLAUDE_PROJECT_DIR: dir };
    delete env.INCIDENT_LAB_AUTHOR;
    if (author) env.INCIDENT_LAB_AUTHOR = '1';
    const res = spawnSync('node', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: dir, prompt: 'fix lab 2' }),
      env,
      encoding: 'utf8',
    });
    assert.equal(res.status, 0, res.stderr);
    return res.stdout ? JSON.parse(res.stdout).hookSpecificOutput : undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('labs 1–4 get the coach-mode reminder', () => {
  const out = remind(3);
  assert.equal(out.hookEventName, 'UserPromptSubmit');
  assert.match(out.additionalContext, /^Coach mode active \(lab 3\)/);
});

test('missing .lab-state means lab 1', () => {
  assert.match(remind(undefined).additionalContext, /Coach mode active \(lab 1\)/);
});

test('lab 5 switches to agent mode', () => {
  assert.match(remind(5).additionalContext, /^Agent mode \(lab 5\)/);
});

test('author mode emits nothing', () => {
  assert.equal(remind(2, { author: true }), undefined);
});
