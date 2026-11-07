import { Module } from '@nestjs/common';
import { NotificationService } from './notifications/application/NotificationService';
import { Mailer } from './notifications/domain/Mailer';
import { Orders } from './notifications/domain/Orders';
import { HealthController } from './notifications/infrastructure/http/HealthController';
import { SmtpMailer } from './notifications/infrastructure/mail/SmtpMailer';
import { OrderPaidConsumer } from './notifications/infrastructure/messaging/OrderPaidConsumer';
import { HttpOrders } from './notifications/infrastructure/orders/HttpOrders';
import { RabbitMq } from './shared/infrastructure/messaging/RabbitMq';

@Module({
  controllers: [HealthController],
  providers: [
    NotificationService,
    RabbitMq,
    OrderPaidConsumer,
    { provide: Mailer, useClass: SmtpMailer },
    { provide: Orders, useClass: HttpOrders },
  ],
})
export class AppModule {}
