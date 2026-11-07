import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidArgumentError } from '../../../shared/domain/InvalidArgumentError';
import { OrderNotFoundError } from '../../domain/OrderNotFoundError';
import { OrderStateError } from '../../domain/OrderStateError';
import { PaymentsUnavailableError } from '../payments/PaymentsUnavailableError';
import { UpstreamError } from '../upstream/UpstreamError';

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.map(error);
    response.status(status).json(body);
  }

  private map(error: unknown): [number, Record<string, unknown>] {
    if (error instanceof HttpException) return [error.getStatus(), { error: error.message }];
    if (error instanceof InvalidArgumentError) return [400, { error: error.message }];
    if (error instanceof OrderNotFoundError) return [404, { error: error.message }];
    if (error instanceof OrderStateError) return [409, { error: error.message }];
    if (error instanceof UpstreamError && error.isClientError()) return [error.status ?? 400, { error: error.message }];
    if (error instanceof UpstreamError) return [502, { error: 'upstream error' }];
    if (error instanceof PaymentsUnavailableError) return [502, { error: 'upstream error' }];
    return [500, { error: 'internal error' }];
  }
}
