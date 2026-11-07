import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidArgumentError } from '../../../shared/domain/InvalidArgumentError';
import { EventNotFoundError } from '../../domain/EventNotFoundError';
import { NotEnoughSeatsError } from '../../domain/NotEnoughSeatsError';

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
    if (error instanceof EventNotFoundError) return [404, { error: error.message }];
    if (error instanceof NotEnoughSeatsError) return [409, { error: error.message }];
    return [500, { error: 'internal error' }];
  }
}
