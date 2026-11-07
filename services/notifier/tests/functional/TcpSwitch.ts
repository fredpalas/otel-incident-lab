import { createConnection, createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';

/** A TCP forwarder that can be switched off, to simulate a mail server that drops connections. */
export class TcpSwitch {
  enabled = true;
  private server?: Server;
  private readonly sockets = new Set<Socket>();

  constructor(
    private readonly host: string,
    private readonly port: number,
  ) {}

  async start(): Promise<number> {
    this.server = createServer((client) => {
      this.sockets.add(client);
      client.on('close', () => this.sockets.delete(client));
      if (!this.enabled) {
        client.destroy();
        return;
      }
      const upstream = createConnection(this.port, this.host);
      client.pipe(upstream).pipe(client);
      upstream.on('error', () => client.destroy());
      client.on('error', () => upstream.destroy());
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    return (this.server?.address() as AddressInfo).port;
  }

  stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
