import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger';
import { InvalidArgumentError } from '../../../shared/domain/InvalidArgumentError';
import { PaymentProviderError } from '../psp/PaymentProviderError';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const [status, body] = this.map(error);
    if (status >= 500) {
      const orderId = (http.getRequest<Request>().body as { orderId?: unknown } | undefined)?.orderId;
      logger.error({ order_id: orderId, err: error }, 'charge failed: payment provider error');
    }
    response.status(status).json(body);
  }

  private map(error: unknown): [number, Record<string, unknown>] {
    if (error instanceof HttpException) return [error.getStatus(), { error: error.message }];
    if (error instanceof InvalidArgumentError) return [400, { error: error.message }];
    if (error instanceof PaymentProviderError) return [502, { error: 'upstream error' }];
    return [500, { error: 'internal error' }];
  }
}
