import { env } from './env.ts';
import { getJson } from './http.ts';

interface LokiResponse {
  data: { result: Array<{ stream: Record<string, string>; values: Array<[string, string]> }> };
}

export interface LogLine {
  labels: Record<string, string>;
  line: string;
}

export async function queryLogs(logql: string, sinceMs: number, limit = 500): Promise<LogLine[]> {
  const params = new URLSearchParams({
    query: logql,
    start: `${sinceMs}000000`,
    end: `${Date.now() + 1_000}000000`,
    limit: String(limit),
    direction: 'forward',
  });
  const body = await getJson<LokiResponse>(`${env.lokiUrl}/loki/api/v1/query_range?${params}`);
  return body.data.result.flatMap((s) => s.values.map(([, line]) => ({ labels: s.stream, line })));
}
