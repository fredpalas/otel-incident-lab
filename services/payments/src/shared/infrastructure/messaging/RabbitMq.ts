import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { type Channel, type ChannelModel, connect } from 'amqplib';
import { config } from '../../../config';

/** Topic exchange every service publishes its events to, routed by event name. */
export const EXCHANGE = 'ticketing';

/** One connection and channel per process, opened on first use. */
@Injectable()
export class RabbitMq implements OnApplicationShutdown {
  private connection?: Promise<ChannelModel>;
  private opened?: Promise<Channel>;

  channel(): Promise<Channel> {
    this.opened ??= this.open();
    return this.opened;
  }

  private async open(): Promise<Channel> {
    this.connection = connect(config.amqpUrl);
    const channel = await (await this.connection).createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    return channel;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.connection) await (await this.connection).close();
  }
}
