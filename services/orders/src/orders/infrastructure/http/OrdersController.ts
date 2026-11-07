import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CheckoutService } from '../../application/CheckoutService';
import type { OrderDto } from '../../domain/OrderDto';
import { parsePlaceOrderRequest } from './PlaceOrderRequest';

@Controller('orders')
export class OrdersController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  @HttpCode(201)
  place(@Body() body: unknown): Promise<OrderDto> {
    return this.checkout.placeOrder(parsePlaceOrderRequest(body));
  }

  @Post(':id/notification')
  @HttpCode(204)
  confirmNotification(@Param('id') id: string): Promise<void> {
    return this.checkout.confirmNotification(id);
  }

  @Get(':id')
  find(@Param('id') id: string): Promise<OrderDto> {
    return this.checkout.findOrder(id);
  }
}
