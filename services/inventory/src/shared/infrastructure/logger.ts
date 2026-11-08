import { propagation } from '@opentelemetry/api';
import pino from 'pino';

// stdout for `docker compose logs`, OTLP for Loki. The OTLP transport reads the
// standard OTEL_* env vars (service name, Collector endpoint).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Every line of a request (or of a message it caused) carries its correlation_id.
  mixin: () => {
    const correlationId = propagation.getActiveBaggage()?.getEntry('correlation_id')?.value;
    return correlationId ? { correlation_id: correlationId } : {};
  },
  transport: {
    targets: [
      { target: 'pino/file', options: { destination: 1 } },
      { target: 'pino-opentelemetry-transport' },
    ],
  },
});
