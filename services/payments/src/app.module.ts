import { Module } from '@nestjs/common';
import { PaymentService } from './payments/application/PaymentService';
import { PaymentEvents } from './payments/domain/PaymentEvents';
import { PaymentProvider } from './payments/domain/PaymentProvider';
import { HealthController } from './payments/infrastructure/http/HealthController';
import { PaymentsController } from './payments/infrastructure/http/PaymentsController';
import { AmqpPaymentEvents } from './payments/infrastructure/messaging/AmqpPaymentEvents';
import { HttpPaymentProvider } from './payments/infrastructure/psp/HttpPaymentProvider';
import { RabbitMq } from './shared/infrastructure/messaging/RabbitMq';

@Module({
  controllers: [PaymentsController, HealthController],
  providers: [
    PaymentService,
    RabbitMq,
    { provide: PaymentProvider, useClass: HttpPaymentProvider },
    { provide: PaymentEvents, useClass: AmqpPaymentEvents },
  ],
})
export class AppModule {}
