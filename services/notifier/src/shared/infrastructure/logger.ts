import pino from 'pino';

// stdout for `docker compose logs`, OTLP for Loki. The OTLP transport reads the
// standard OTEL_* env vars (service name, Collector endpoint).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: {
    targets: [
      { target: 'pino/file', options: { destination: 1 } },
      { target: 'pino-opentelemetry-transport' },
    ],
  },
});
