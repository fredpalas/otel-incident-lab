import { InvalidArgumentError } from '../../shared/domain/InvalidArgumentError';
import type { Money } from './Money';

export class PaymentRequest {
  private constructor(
    readonly orderId: string,
    readonly customerId: string,
    readonly amount: Money,
  ) {}

  static of(orderId: string, customerId: string, amount: Money): PaymentRequest {
    if (orderId.trim() === '') throw new InvalidArgumentError('orderId is required');
    if (customerId.trim() === '') throw new InvalidArgumentError('customerId is required');
    if (amount.cents === 0) throw new InvalidArgumentError('cannot charge a zero amount');
    return new PaymentRequest(orderId, customerId, amount);
  }
}
