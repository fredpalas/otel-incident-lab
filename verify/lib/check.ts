export type Result = { ok: true; detail?: string } | { ok: false; hint: string };

export interface Check {
  id: string;
  description: string;
  run(): Promise<Result>;
}

export const pass = (detail?: string): Result => ({ ok: true, detail });
export const fail = (hint: string): Result => ({ ok: false, hint });

export const runId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Polls `probe` until it returns a value or the timeout expires (ingestion is async). */
export async function poll<T>(
  probe: () => Promise<T | undefined>,
  { timeoutMs = 30_000, intervalMs = 1_000 } = {},
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) return value;
    if (Date.now() >= deadline) return undefined;
    await sleep(intervalMs);
  }
}
