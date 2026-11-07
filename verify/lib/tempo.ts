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

type AnyValue = { stringValue?: string; intValue?: string | number; boolValue?: boolean; doubleValue?: number };
interface OtlpAttribute {
  key: string;
  value: AnyValue;
}
interface OtlpSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: string | number;
  status?: { code?: string | number; message?: string };
  attributes?: OtlpAttribute[];
}
interface OtlpResourceSpans {
  resource?: { attributes?: OtlpAttribute[] };
  scopeSpans?: Array<{ spans?: OtlpSpan[] }>;
}

export interface Span {
  id: string;
  parentId?: string;
  name: string;
  service: string;
  kind: 'server' | 'client' | 'internal' | 'producer' | 'consumer' | 'unspecified';
  error: boolean;
  attributes: Record<string, string | number | boolean>;
  depth: number;
}

const KINDS = ['unspecified', 'internal', 'server', 'client', 'producer', 'consumer'] as const;

const toKind = (kind: string | number | undefined): Span['kind'] => {
  if (typeof kind === 'number') return KINDS[kind] ?? 'unspecified';
  const name = (kind ?? '').replace('SPAN_KIND_', '').toLowerCase();
  return (KINDS as readonly string[]).includes(name) ? (name as Span['kind']) : 'unspecified';
};

const toValue = (v: AnyValue): string | number | boolean =>
  v.stringValue ?? v.boolValue ?? v.doubleValue ?? (v.intValue !== undefined ? Number(v.intValue) : '');

const toRecord = (attrs: OtlpAttribute[] = []): Span['attributes'] =>
  Object.fromEntries(attrs.map((a) => [a.key, toValue(a.value)]));

/** All spans of one trace, flattened, with their depth in the tree. undefined if Tempo doesn't have it (yet). */
export async function getTrace(traceId: string): Promise<Span[] | undefined> {
  const res = await fetch(`${env.tempoUrl}/api/traces/${traceId}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`tempo trace ${traceId}: ${res.status}`);
  const body = (await res.json()) as { batches?: OtlpResourceSpans[]; resourceSpans?: OtlpResourceSpans[] };

  const spans: Span[] = (body.batches ?? body.resourceSpans ?? []).flatMap((rs) => {
    const service = String(toRecord(rs.resource?.attributes)['service.name'] ?? 'unknown');
    return (rs.scopeSpans ?? []).flatMap((ss) =>
      (ss.spans ?? []).map((s) => ({
        id: s.spanId,
        parentId: s.parentSpanId || undefined,
        name: s.name,
        service,
        kind: toKind(s.kind),
        error: s.status?.code === 'STATUS_CODE_ERROR' || s.status?.code === 2,
        attributes: toRecord(s.attributes),
        depth: 0,
      })),
    );
  });

  const byId = new Map(spans.map((s) => [s.id, s]));
  const depthOf = (s: Span, seen = 0): number => {
    const parent = s.parentId ? byId.get(s.parentId) : undefined;
    return parent && seen < 100 ? 1 + depthOf(parent, seen + 1) : 0;
  };
  for (const s of spans) s.depth = depthOf(s);
  return spans.length > 0 ? spans : undefined;
}

export const deepestErrorSpan = (spans: Span[]): Span | undefined =>
  spans.filter((s) => s.error).sort((a, b) => b.depth - a.depth)[0];
