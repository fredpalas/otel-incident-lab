import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from './config';
import { CheckoutService } from './orders/application/CheckoutService';
import { OrderRepository } from './orders/domain/OrderRepository';
import { PaymentGateway } from './orders/domain/PaymentGateway';
import { Customers } from './orders/domain/Customers';
import { Pricing } from './orders/domain/Pricing';
import { RabbitMq } from './shared/infrastructure/messaging/RabbitMq';
import { SeatReservations } from './orders/domain/SeatReservations';
import { HttpCustomers } from './orders/infrastructure/catalog/HttpCustomers';
import { HttpPricing } from './orders/infrastructure/catalog/HttpPricing';
import { HealthController } from './orders/infrastructure/http/HealthController';
import { OrdersController } from './orders/infrastructure/http/OrdersController';
import { HttpPaymentGateway } from './orders/infrastructure/payments/HttpPaymentGateway';
import { HttpSeatReservations } from './orders/infrastructure/inventory/HttpSeatReservations';
import { OutboxRelay } from './orders/infrastructure/messaging/OutboxRelay';
import { PgOrderRepository } from './orders/infrastructure/persistence/PgOrderRepository';

@Module({
  controllers: [OrdersController, HealthController],
  providers: [
    CheckoutService,
    RabbitMq,
    OutboxRelay,
    { provide: Pool, useFactory: (): Pool => new Pool({ connectionString: config.databaseUrl, max: 5 }) },
    { provide: OrderRepository, useClass: PgOrderRepository },
    { provide: PaymentGateway, useClass: HttpPaymentGateway },
    { provide: SeatReservations, useClass: HttpSeatReservations },
    { provide: Pricing, useClass: HttpPricing },
    { provide: Customers, useClass: HttpCustomers },
  ],
})
export class AppModule implements OnApplicationShutdown {
  constructor(private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
