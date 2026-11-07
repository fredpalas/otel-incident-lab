/** Messaging tests run against a real RabbitMQ (CI service or local container). */
export function testAmqpUrl(): string {
  const url = process.env.TEST_AMQP_URL;
  if (!url) throw new Error('TEST_AMQP_URL is required for messaging tests');
  return url;
}
