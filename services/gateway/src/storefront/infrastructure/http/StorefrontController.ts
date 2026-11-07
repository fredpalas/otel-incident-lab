import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { StorefrontService } from '../../application/StorefrontService';
import type { OrderView } from '../../domain/OrderView';
import { parseCheckoutRequest } from './CheckoutRequest';

@Controller()
export class StorefrontController {
  constructor(private readonly storefront: StorefrontService) {}

  @Post('checkout')
  @HttpCode(201)
  checkout(@Body() body: unknown): Promise<OrderView> {
    return this.storefront.checkout(parseCheckoutRequest(body));
  }

  @Get('orders/:id')
  order(@Param('id') id: string): Promise<OrderView> {
    return this.storefront.order(id);
  }
}
