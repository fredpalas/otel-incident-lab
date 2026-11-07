import { Injectable } from '@nestjs/common';
import { Money } from '../domain/Money';
import type { PaymentDto } from '../domain/PaymentDto';
import { PaymentEvents } from '../domain/PaymentEvents';
import { PaymentProvider } from '../domain/PaymentProvider';
import { PaymentRequest } from '../domain/PaymentRequest';
import type { PayCommand } from './PayCommand';

@Injectable()
export class PaymentService {
  constructor(
    private readonly provider: PaymentProvider,
    private readonly events: PaymentEvents,
  ) {}

  async pay(command: PayCommand): Promise<PaymentDto> {
    const request = PaymentRequest.of(command.orderId, command.customerId, Money.of(command.amountCents, command.currency));
    let charge;
    try {
      charge = await this.provider.charge(request);
    } catch (error) {
      // Lets inventory release the seats held for this order.
      await this.events.paymentFailed(request, (error as Error).message);
      throw error;
    }
    return { paymentId: charge.chargeId, orderId: request.orderId, status: charge.status };
  }
}
