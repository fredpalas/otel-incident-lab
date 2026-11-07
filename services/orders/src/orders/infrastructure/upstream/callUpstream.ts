import { UpstreamError } from './UpstreamError';

/** JSON call to another internal service; any non-2xx answer becomes an UpstreamError. */
export async function callUpstream<T>(upstream: string, url: string, timeoutMs: number, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      // not JSON: keep the raw body
    }
    throw new UpstreamError(upstream, message, response.status);
  }
  return JSON.parse(text) as T;
}
