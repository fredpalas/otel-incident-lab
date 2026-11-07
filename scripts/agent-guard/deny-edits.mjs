#!/usr/bin/env node
// PreToolUse hook: in labs 1–4, deny edits to lab code and peeks at solutions; in every
// lab, deny peeks at the lab 5 incident.
import { AGENT_LAB, denyReason, isAuthor, projectDirOf, readLab, readStdinJson, spoilerReason, spoilsIncident, violates } from './lib.mjs';

if (isAuthor()) process.exit(0);

const payload = await readStdinJson();
const projectDir = projectDirOf(payload);
const lab = readLab(projectDir);

const reason = spoilsIncident(payload, projectDir)
  ? spoilerReason
  : lab < AGENT_LAB && violates(payload, projectDir)
    ? denyReason(lab)
    : undefined;

if (reason) {
  if (process.argv.includes('--copilot')) {
    // Copilot CLI (.github/hooks): top-level decision; exit 2 denies whatever stdout says.
    process.stdout.write(JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: reason }));
    process.stderr.write(reason);
    process.exit(2);
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
}
