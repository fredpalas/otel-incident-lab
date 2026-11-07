// Loaded before the app (node --import) so the auto-instrumentations can patch http,
// express, nestjs, pg, fetch (undici) and pino as they are first required.
// Service name and Collector endpoint come from the standard OTEL_* env vars.
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      // Low-level noise that buries the spans that matter when reading a trace.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-router': { enabled: false },
      // Docker's healthcheck hits /health every few seconds: one trace each would bury the rest.
      '@opentelemetry/instrumentation-http': { ignoreIncomingRequestHook: (req) => req.url === '/health' },
      '@opentelemetry/instrumentation-express': { ignoreLayersType: [ExpressLayerType.MIDDLEWARE] },
      // Database calls outside a request (the outbox relay polling) are not worth a trace each.
      '@opentelemetry/instrumentation-pg': { requireParentSpan: true },
      // Only add trace_id/span_id to log lines: pino-opentelemetry-transport already
      // ships the logs, sending them through the SDK as well would duplicate them.
      '@opentelemetry/instrumentation-pino': { disableLogSending: true },
    }),
  ],
});
sdk.start();

process.on('SIGTERM', () => {
  void sdk.shutdown();
});
