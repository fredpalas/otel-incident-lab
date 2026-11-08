import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { config } from './config';
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
  providers: [
    ReservationService,
    InventorySchema,
    RabbitMq,
    PaymentFailedConsumer,
    // Postgres allows 20 connections for every service together; keep a few open and reuse them.
    {
      provide: Pool,
      useFactory: (): Pool => new Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30_000 }),
    },
    { provide: UnitOfWork, useClass: PgUnitOfWork },
  ],
})
export class AppModule implements OnApplicationShutdown {
  constructor(private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
