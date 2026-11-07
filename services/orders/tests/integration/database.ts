/** Integration and functional tests run against a real Postgres (CI service or local container). */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is required for integration/functional tests');
  return url;
}
