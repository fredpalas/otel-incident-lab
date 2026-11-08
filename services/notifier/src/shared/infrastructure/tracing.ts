import { type Attributes, type Span, SpanStatusCode, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('notifier');

/** Where the code of a span lives in the repository (the source, not the compiled file). */
const sourcePath = (file: string): string =>
  file.replace(/^.*?\/services\//, 'services/').replace('/dist/', '/src/').replace(/\.js$/, '.ts');

/**
 * Runs `work` in a span of its own. code.function.name and code.file.path let anyone (or
 * an agent) go from the span to the code that produced it.
 */
export function inSpan<T>(functionName: string, file: string, attributes: Attributes, work: (span: Span) => Promise<T>): Promise<T> {
  const codeAttributes = { 'code.function.name': functionName, 'code.file.path': sourcePath(file) };
  return tracer.startActiveSpan(functionName, { attributes: { ...codeAttributes, ...attributes } }, async (span) => {
    try {
      return await work(span);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
      throw error;
    } finally {
      span.end();
    }
  });
}
