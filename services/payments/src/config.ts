const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : Number.parseInt(raw, 10);
};

// Getters so values are read when used, not when the module is first imported.
export const config = {
  get port(): number {
    return intFromEnv('PORT', 3000);
  },
  get pspUrl(): string {
    return process.env.PSP_URL ?? 'http://toxiproxy:8666';
  },
  get pspTimeoutMs(): number {
    return intFromEnv('PSP_TIMEOUT_MS', 300);
  },
  get pspRetries(): number {
    return intFromEnv('PSP_RETRIES', 3);
  },
  get amqpUrl(): string {
    return process.env.AMQP_URL ?? 'amqp://guest:guest@rabbitmq:5672';
  },
};
