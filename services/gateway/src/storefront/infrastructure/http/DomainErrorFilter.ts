import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger';
import { InvalidArgumentError } from '../../../shared/domain/InvalidArgumentError';
import { UpstreamError } from '../orders/UpstreamError';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.map(error);
    if (status >= 500) logger.error({ err: error, status }, 'checkout failed: upstream error');
    response.status(status).json(body);
  }

  private map(error: unknown): [number, unknown] {
    if (error instanceof HttpException) return [error.getStatus(), { error: error.message }];
    if (error instanceof InvalidArgumentError) return [400, { error: error.message }];
    // Client errors from orders are the customer's to fix; anything else is ours.
    if (error instanceof UpstreamError) {
      return error.status < 500 ? [error.status, error.body] : [502, { error: 'upstream error' }];
    }
    if (error instanceof Error && error.name === 'TimeoutError') return [504, { error: 'upstream timeout' }];
    if (error instanceof TypeError) return [502, { error: 'upstream error' }];
    return [500, { error: 'internal error' }];
  }
}
