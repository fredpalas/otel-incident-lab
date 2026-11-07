// Coach-mode policy (docs/06-ai-guardrails.md). Pure functions; the hook scripts do the I/O.
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

export const AGENT_LAB = 5;

export function isAuthor(env = process.env) {
  return env.OTEL_LAB_AUTHOR === '1';
}

export function readLab(projectDir) {
  try {
    const match = readFileSync(join(projectDir, '.lab-state'), 'utf8').match(/^lab=(\d+)/m);
    return match ? Number(match[1]) : 1;
  } catch {
    return 1;
  }
}

const PROTECTED_WRITE = /^(services|observability|scenarios)(\/|$)/;
const PROTECTED_READ = [
  /^labs\/[^/]+\/SOLUTION\.md$/i,
  /^docs\/02-defects-catalog\.md$/,
  /^docs\/authoring(\/|$)/,
  /^scenarios\/incident-5(\/|$)/,
];
const OBSERVABILITY_MCP = /^mcp__.*(grafana|tempo|loki|prometheus)/i;

const isProtectedRead = (p) => PROTECTED_READ.some((re) => re.test(p));

function toRepoPath(projectDir, filePath) {
  if (!filePath) return '';
  const normalized = String(filePath).replace(/\\/g, '/');
  const rel = isAbsolute(normalized) ? relative(projectDir.replace(/\\/g, '/'), normalized) : normalized;
  return rel.replace(/^\.\//, '');
}

// Shell words that look like paths, stripped of quotes and a leading ./
function pathTokens(command) {
  return command
    .split(/[\s;&|()<>"'`=]+/)
    .filter(Boolean)
    .map((t) => t.replace(/^\.\//, ''));
}

const SHELL_WRITERS = /(^|[\s;&|(])(sed\s+(-[a-zA-Z]*\s+)*-i|perl\s+-[a-zA-Z]*i|tee|cp|mv|rm|touch|install|dd|truncate)\b/;
const PATCHERS = /(^|[;&|(]\s*|^\s*)(git\s+apply|git\s+am|patch)\b/;
const SOLUTION_REF = /lab-\d+-solution|solution\/lab-\d+/;
const GIT_PEEK = /\bgit\s+(checkout|switch|diff|show|log|restore|cherry-pick|merge|reset|archive|worktree)\b/;
const MAKE_SOLUTION = /\bmake\s+(.*\s)?solution\b|jump\.sh\s+solution/;

function bashViolation(command) {
  const tokens = pathTokens(command);
  if (tokens.some(isProtectedRead) || /SOLUTION\.md/i.test(command)) return true;
  if (MAKE_SOLUTION.test(command)) return true;
  if (GIT_PEEK.test(command) && SOLUTION_REF.test(command)) return true;
  if (PATCHERS.test(command)) return true;

  const touchesProtected = tokens.some((t) => PROTECTED_WRITE.test(t));
  if (touchesProtected && SHELL_WRITERS.test(command)) return true;
  for (const m of command.matchAll(/>{1,2}\s*([^\s;&|]+)/g)) {
    const target = m[1].replace(/^["']|["']$/g, '').replace(/^\.\//, '');
    if (PROTECTED_WRITE.test(target)) return true;
  }
  return false;
}

/** @returns {boolean} true when the tool call must be denied in coach mode. */
export function violates(payload, projectDir) {
  const tool = payload.tool_name ?? '';
  const input = payload.tool_input ?? {};

  if (OBSERVABILITY_MCP.test(tool)) return true;
  switch (tool) {
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return PROTECTED_WRITE.test(toRepoPath(projectDir, input.file_path ?? input.notebook_path));
    case 'Read':
    case 'Grep':
    case 'Glob':
      return isProtectedRead(toRepoPath(projectDir, input.file_path ?? input.path));
    case 'Bash':
      return bashViolation(String(input.command ?? ''));
    default:
      return false;
  }
}

export const denyReason = (lab) =>
  `Lab ${lab} is hands-on without AI 🙂 Ask me for a hint or a guiding question instead. ` +
  `Stuck? make solution N=${lab}. The agent unlocks in lab ${AGENT_LAB}.`;

export const promptReminder = (lab) =>
  lab < AGENT_LAB
    ? `Coach mode active (lab ${lab}). Follow AGENTS.md: hints and questions only; no code for services/, observability/, scenarios/; don't read SOLUTION.md or authoring docs.`
    : `Agent mode (lab ${AGENT_LAB}): follow labs/05-ai-mcp/README.md; ask before editing.`;

export async function readStdinJson() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export const projectDirOf = (payload) => process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
