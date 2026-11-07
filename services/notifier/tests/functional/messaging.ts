/** Messaging tests run against a real RabbitMQ (CI service or local container). */
export function testAmqpUrl(): string {
  const url = process.env.TEST_AMQP_URL;
  if (!url) throw new Error('TEST_AMQP_URL is required for messaging tests');
  return url;
}

/** Mailpit: SMTP for the service under test, HTTP API to read what it received. */
export function testSmtp(): { host: string; port: number; api: string } {
  const host = process.env.TEST_SMTP_HOST;
  const port = process.env.TEST_SMTP_PORT;
  const api = process.env.TEST_MAILPIT_API;
  if (!host || !port || !api) throw new Error('TEST_SMTP_HOST, TEST_SMTP_PORT and TEST_MAILPIT_API are required');
  return { host, port: Number(port), api };
}
