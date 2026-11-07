export class OrderNotFoundError extends Error {
  override readonly name = 'OrderNotFoundError';

  constructor(id: string) {
    super(`order ${id} not found`);
  }
}
