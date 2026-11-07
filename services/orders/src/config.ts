const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  return raw === undefined || raw === '' ? fallback : Number.parseInt(raw, 10);
};

// Getters so values are read when used, not when the module is first imported.
export const config = {
  get port(): number {
    return intFromEnv('PORT', 3000);
  },
  get databaseUrl(): string {
    return process.env.DATABASE_URL ?? 'postgres://lab:lab@localhost:5432/lab';
  },
  get paymentsUrl(): string {
    return process.env.PAYMENTS_URL ?? 'http://payments:3000';
  },
  get paymentsTimeoutMs(): number {
    return intFromEnv('PAYMENTS_TIMEOUT_MS', 1000);
  },
  get inventoryUrl(): string {
    return process.env.INVENTORY_URL ?? 'http://inventory:3000';
  },
  get inventoryTimeoutMs(): number {
    return intFromEnv('INVENTORY_TIMEOUT_MS', 1000);
  },
  get catalogUrl(): string {
    return process.env.CATALOG_URL ?? 'http://catalog:3000';
  },
  get catalogTimeoutMs(): number {
    return intFromEnv('CATALOG_TIMEOUT_MS', 1000);
  },
  get amqpUrl(): string {
    return process.env.AMQP_URL ?? 'amqp://guest:guest@rabbitmq:5672';
  },
  get outboxPollMs(): number {
    return intFromEnv('OUTBOX_POLL_MS', 500);
  },
};
