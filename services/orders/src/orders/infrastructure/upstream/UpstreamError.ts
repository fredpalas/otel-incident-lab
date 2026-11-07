/** A service we depend on answered with an error (status) or not at all (no status). */
export class UpstreamError extends Error {
  override readonly name = 'UpstreamError';

  constructor(
    readonly upstream: string,
    message: string,
    readonly status?: number,
  ) {
    super(`${upstream}: ${message}`);
  }

  isClientError(): boolean {
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }
}
