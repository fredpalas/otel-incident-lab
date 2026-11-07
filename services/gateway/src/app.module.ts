import { Module } from '@nestjs/common';
import { StorefrontService } from './storefront/application/StorefrontService';
import { OrdersApi } from './storefront/domain/OrdersApi';
import { HealthController } from './storefront/infrastructure/http/HealthController';
import { StorefrontController } from './storefront/infrastructure/http/StorefrontController';
import { HttpOrdersApi } from './storefront/infrastructure/orders/HttpOrdersApi';

@Module({
  controllers: [StorefrontController, HealthController],
  providers: [StorefrontService, { provide: OrdersApi, useClass: HttpOrdersApi }],
})
export class AppModule {}
