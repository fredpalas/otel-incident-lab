import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  url: string;
  body: unknown;
}

/** Minimal HTTP stand-in for a downstream service. */
export class StubServer {
  readonly requests: RecordedRequest[] = [];
  private server?: Server;

  constructor(private readonly reply: (req: RecordedRequest) => { status: number; body: unknown }) {}

  async start(): Promise<string> {
    this.server = createServer(async (req: IncomingMessage, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const recorded = { method: req.method ?? '', url: req.url ?? '', body: raw ? JSON.parse(raw) : undefined };
      this.requests.push(recorded);
      const { status, body } = this.reply(recorded);
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
