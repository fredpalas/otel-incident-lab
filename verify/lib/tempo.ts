import { env } from './env.ts';
import { getJson } from './http.ts';

interface TempoSearch {
  traces?: Array<{ traceID: string; rootServiceName?: string; rootTraceName?: string }>;
}

export async function searchTraces(traceql: string, sinceMs: number, limit = 100): Promise<TempoSearch['traces']> {
  const params = new URLSearchParams({
    q: traceql,
    start: String(Math.floor(sinceMs / 1000)),
    end: String(Math.ceil(Date.now() / 1000) + 1),
    limit: String(limit),
  });
  const body = await getJson<TempoSearch>(`${env.tempoUrl}/api/search?${params}`);
  return body.traces ?? [];
}
