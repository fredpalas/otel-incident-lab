import { Module } from '@nestjs/common';
import { CustomerService } from './customers/application/CustomerService';
import { CustomerRepository } from './customers/domain/CustomerRepository';
import { CustomersController } from './customers/infrastructure/CustomersController';
import { InMemoryCustomerRepository } from './customers/infrastructure/InMemoryCustomerRepository';
import { PricingService } from './pricing/application/PricingService';
import { EventDiscountRepository } from './pricing/domain/EventDiscountRepository';
import { PriceRepository } from './pricing/domain/PriceRepository';
import { InMemoryEventDiscountRepository } from './pricing/infrastructure/InMemoryEventDiscountRepository';
import { InMemoryPriceRepository } from './pricing/infrastructure/InMemoryPriceRepository';
import { PricingController } from './pricing/infrastructure/PricingController';
import { HealthController } from './shared/infrastructure/http/HealthController';

@Module({
  controllers: [PricingController, CustomersController, HealthController],
  providers: [
    PricingService,
    CustomerService,
    { provide: PriceRepository, useValue: new InMemoryPriceRepository() },
    { provide: EventDiscountRepository, useClass: InMemoryEventDiscountRepository },
    { provide: CustomerRepository, useClass: InMemoryCustomerRepository },
  ],
})
export class AppModule {}
