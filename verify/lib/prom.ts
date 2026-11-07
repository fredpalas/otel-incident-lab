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
