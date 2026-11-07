export class UpstreamError extends Error {
  override readonly name = 'UpstreamError';

  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`orders responded ${status}`);
  }
}
