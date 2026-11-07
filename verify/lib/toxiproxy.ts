import { env } from './env.ts';

export interface Toxic {
  name: string;
  type: string;
  stream?: 'upstream' | 'downstream';
  toxicity?: number;
  attributes: Record<string, number>;
}

const url = (path: string): string => `${env.toxiproxyUrl}${path}`;

export async function listToxics(proxy: string): Promise<Toxic[]> {
  const res = await fetch(url(`/proxies/${proxy}/toxics`));
  if (!res.ok) throw new Error(`toxiproxy ${proxy}: ${res.status}`);
  return (await res.json()) as Toxic[];
}

export async function replaceToxics(proxy: string, toxics: Toxic[]): Promise<void> {
  for (const t of await listToxics(proxy)) {
    await fetch(url(`/proxies/${proxy}/toxics/${t.name}`), { method: 'DELETE' });
  }
  for (const t of toxics) {
    const res = await fetch(url(`/proxies/${proxy}/toxics`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(t),
    });
    if (!res.ok) throw new Error(`toxiproxy add ${t.name}: ${res.status} ${await res.text()}`);
  }
}

const pendingRestores = new Set<() => Promise<void>>();

/**
 * Runs `fn` with `toxics` replacing the proxy's current ones, then restores the
 * participant's scenario. Verify needs deterministic failures; the scenario's
 * low-toxicity faults would make checks flaky.
 */
export async function withToxics<T>(proxy: string, toxics: Toxic[], fn: () => Promise<T>): Promise<T> {
  const previous = await listToxics(proxy);
  const restore = (): Promise<void> => replaceToxics(proxy, previous);
  pendingRestores.add(restore);
  await replaceToxics(proxy, toxics);
  try {
    return await fn();
  } finally {
    pendingRestores.delete(restore);
    await restore();
  }
}

/** Puts back every scenario a `withToxics` still holds: an interrupted verify must not leave the PSP failing 100 %. */
export async function restoreScenario(): Promise<void> {
  for (const restore of [...pendingRestores].reverse()) await restore().catch(() => undefined);
  pendingRestores.clear();
}
