export type SpanAttributeValue = string | number | boolean;

export interface TracedSpan {
  setAttribute(key: string, value: SpanAttributeValue): void;
}

/**
 * Port: a span around a unit of work where the business lives. `file` is the caller's
 * `__filename`, so the span's code.file.path points at the application code, not at the adapter.
 */
export abstract class Tracer {
  abstract inSpan<T>(
    functionName: string,
    file: string,
    attributes: Record<string, SpanAttributeValue>,
    work: (span: TracedSpan) => Promise<T>,
  ): Promise<T>;
}
