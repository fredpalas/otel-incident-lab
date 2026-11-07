#!/usr/bin/env node
// PreToolUse hook: in labs 1–4, deny edits to lab code and peeks at solutions.
import { AGENT_LAB, denyReason, isAuthor, projectDirOf, readLab, readStdinJson, violates } from './lib.mjs';

if (isAuthor()) process.exit(0);

const payload = await readStdinJson();
const projectDir = projectDirOf(payload);
const lab = readLab(projectDir);

if (lab < AGENT_LAB && violates(payload, projectDir)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: denyReason(lab),
      },
    }),
  );
}
