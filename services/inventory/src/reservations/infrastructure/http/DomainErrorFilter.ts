import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger';
import { InvalidArgumentError } from '../../../shared/domain/InvalidArgumentError';
import { EventNotFoundError } from '../../domain/EventNotFoundError';
import { NotEnoughSeatsError } from '../../domain/NotEnoughSeatsError';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const [status, body] = this.map(error);
    if (status >= 500) {
      const orderId = (http.getRequest<Request>().body as { orderId?: unknown } | undefined)?.orderId;
      logger.error({ order_id: orderId, err: error }, 'seat reservation failed');
    }
    response.status(status).json(body);
  }

  private map(error: unknown): [number, Record<string, unknown>] {
    if (error instanceof HttpException) return [error.getStatus(), { error: error.message }];
    if (error instanceof InvalidArgumentError) return [400, { error: error.message }];
    if (error instanceof EventNotFoundError) return [404, { error: error.message }];
    if (error instanceof NotEnoughSeatsError) return [409, { error: error.message }];
    return [500, { error: 'internal error' }];
  }
}
