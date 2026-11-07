import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: unknown;
}

export type StubReply = { status: number; body: unknown; delayMs?: number } | 'reset';

/** Minimal HTTP stand-in for a downstream service. */
export class StubServer {
  readonly requests: RecordedRequest[] = [];
  private server?: Server;

  constructor(private reply: (req: RecordedRequest) => StubReply) {}

  replyWith(reply: (req: RecordedRequest) => StubReply): void {
    this.reply = reply;
  }

  async start(): Promise<string> {
    this.server = createServer(async (req: IncomingMessage, res) => {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const recorded = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: raw ? JSON.parse(raw) : undefined,
      };
      this.requests.push(recorded);
      const reply = this.reply(recorded);
      if (reply === 'reset') {
        req.socket.resetAndDestroy();
        return;
      }
      if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));
      if (!res.destroyed) res.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.body));
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    this.server?.closeAllConnections();
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
