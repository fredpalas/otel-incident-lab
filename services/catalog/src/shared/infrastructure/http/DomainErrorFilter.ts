import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { PriceNotFoundError } from '../../../pricing/domain/PriceNotFoundError';
import { InvalidArgumentError } from '../../domain/InvalidArgumentError';

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
    if (error instanceof PriceNotFoundError) return [404, { error: error.message }];
    return [500, { error: 'internal error' }];
  }
}
