import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PaymentService } from '../../application/PaymentService';
import type { PaymentDto } from '../../domain/PaymentDto';
import { parsePayRequest } from './PayRequest';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentService) {}

  @Post()
  @HttpCode(201)
  pay(@Body() body: unknown): Promise<PaymentDto> {
    return this.payments.pay(parsePayRequest(body));
  }
}
