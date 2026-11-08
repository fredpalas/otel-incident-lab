import { Injectable } from '@nestjs/common';
import { type SpanAttributeValue, type TracedSpan, Tracer } from '../application/Tracer';
import { inSpan } from './tracing';

@Injectable()
export class OtelTracer extends Tracer {
  inSpan<T>(
    functionName: string,
    file: string,
    attributes: Record<string, SpanAttributeValue>,
    work: (span: TracedSpan) => Promise<T>,
  ): Promise<T> {
    return inSpan(functionName, file, attributes, work);
  }
}
