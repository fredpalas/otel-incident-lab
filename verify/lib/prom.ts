import { env } from './env.ts';
import { getJson } from './http.ts';

interface PromResponse {
  data: { result: Array<{ metric: Record<string, string>; value: [number, string] }> };
}

export async function instantQuery(promql: string): Promise<PromResponse['data']['result']> {
  const params = new URLSearchParams({ query: promql });
  const body = await getJson<PromResponse>(`${env.prometheusUrl}/api/v1/query?${params}`);
  return body.data.result;
}

interface ExemplarResponse {
  data: Array<{ seriesLabels: Record<string, string>; exemplars: Array<{ labels: Record<string, string>; value: string }> }>;
}

/** Exemplars recorded for the series matching `promql` since `sinceMs`. */
export async function exemplarsSince(promql: string, sinceMs: number): Promise<ExemplarResponse['data']> {
  const params = new URLSearchParams({
    query: promql,
    start: String(Math.floor(sinceMs / 1000)),
    end: String(Math.ceil(Date.now() / 1000) + 1),
  });
  const body = await getJson<ExemplarResponse>(`${env.prometheusUrl}/api/v1/query_exemplars?${params}`);
  return body.data ?? [];
}

/** Unix time (ms) of the newest sample of the series matching `selector`, or undefined. */
export async function latestSampleMs(selector: string): Promise<number | undefined> {
  const [first] = await instantQuery(`max(timestamp(${selector}))`);
  return first ? Number(first.value[1]) * 1000 : undefined;
}
