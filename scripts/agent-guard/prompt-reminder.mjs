#!/usr/bin/env node
// UserPromptSubmit hook: remind the agent which mode the active lab is in.
import { isAuthor, projectDirOf, promptReminder, readLab, readStdinJson } from './lib.mjs';

if (isAuthor()) process.exit(0);

const payload = await readStdinJson();
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: promptReminder(readLab(projectDirOf(payload))),
    },
  }),
);
