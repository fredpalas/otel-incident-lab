const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : Number.parseInt(raw, 10);
};

// Getters so values are read when used, not when the module is first imported.
export const config = {
  get port(): number {
    return intFromEnv('PORT', 3000);
  },
  get amqpUrl(): string {
    return process.env.AMQP_URL ?? 'amqp://guest:guest@rabbitmq:5672';
  },
  get smtpHost(): string {
    return process.env.SMTP_HOST ?? 'toxiproxy';
  },
  get smtpPort(): number {
    return intFromEnv('SMTP_PORT', 1025);
  },
  get ordersUrl(): string {
    return process.env.ORDERS_URL ?? 'http://orders:3000';
  },
  get ordersTimeoutMs(): number {
    return intFromEnv('ORDERS_TIMEOUT_MS', 1000);
  },
  get retryDelayMs(): number {
    return intFromEnv('NOTIFICATION_RETRY_DELAY_MS', 10_000);
  },
};
