import { Module } from '@nestjs/common';
import { ReservationService } from './reservations/application/ReservationService';
import { UnitOfWork } from './reservations/domain/UnitOfWork';
import { HealthController } from './reservations/infrastructure/http/HealthController';
import { ReservationsController } from './reservations/infrastructure/http/ReservationsController';
import { PaymentFailedConsumer } from './reservations/infrastructure/messaging/PaymentFailedConsumer';
import { InventorySchema } from './reservations/infrastructure/persistence/InventorySchema';
import { PgUnitOfWork } from './reservations/infrastructure/persistence/PgUnitOfWork';
import { RabbitMq } from './shared/infrastructure/messaging/RabbitMq';

@Module({
  controllers: [ReservationsController, HealthController],
  providers: [ReservationService, InventorySchema, RabbitMq, PaymentFailedConsumer, { provide: UnitOfWork, useClass: PgUnitOfWork }],
})
export class AppModule {}
