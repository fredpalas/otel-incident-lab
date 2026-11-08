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
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  links?: Array<{ traceId: string; spanId: string }>;
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
  startMs: number;
  endMs: number;
  /** Trace ids (hex) this span links to. */
  links: string[];
}

const KINDS = ['unspecified', 'internal', 'server', 'client', 'producer', 'consumer'] as const;

const toKind = (kind: string | number | undefined): Span['kind'] => {
  if (typeof kind === 'number') return KINDS[kind] ?? 'unspecified';
  const name = (kind ?? '').replace('SPAN_KIND_', '').toLowerCase();
  return (KINDS as readonly string[]).includes(name) ? (name as Span['kind']) : 'unspecified';
};

// Tempo's JSON may carry ids base64-encoded (OTLP/JSON over protobuf bytes) or as hex.
const toHexId = (id: string): string => (/^[0-9a-f]{32}$/i.test(id) ? id.toLowerCase() : Buffer.from(id, 'base64').toString('hex'));

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
        startMs: Number(s.startTimeUnixNano ?? 0) / 1e6,
        endMs: Number(s.endTimeUnixNano ?? 0) / 1e6,
        links: (s.links ?? []).map((l) => toHexId(l.traceId)),
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

/**
 * Fetches each trace until it has spans from every service in `services` (each service
 * exports its own batch, every few seconds). Traces still incomplete at the timeout are
 * returned as they are, missing ones as undefined.
 */
export async function waitForTraces(
  ids: string[],
  services: string[],
  timeoutMs: number,
): Promise<Map<string, Span[] | undefined>> {
  const found = new Map<string, Span[] | undefined>();
  const complete = (spans: Span[] | undefined): boolean =>
    Boolean(spans) && services.every((svc) => spans?.some((s) => s.service === svc));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    for (const id of ids) {
      if (!complete(found.get(id))) found.set(id, (await getTrace(id).catch(() => undefined)) ?? found.get(id));
    }
    if (ids.every((id) => complete(found.get(id))) || Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  // Late spans of a service that already reported arrive in its next batch.
  await new Promise((r) => setTimeout(r, 2_000));
  for (const id of ids) if (found.get(id)) found.set(id, await getTrace(id).catch(() => found.get(id)));
  return found;
}
