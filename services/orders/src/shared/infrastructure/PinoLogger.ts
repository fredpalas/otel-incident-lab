import { Injectable } from '@nestjs/common';
import { Logger } from '../application/Logger';
import { logger } from './logger';

@Injectable()
export class PinoLogger extends Logger {
  error(message: string, context: Record<string, unknown>): void {
    logger.error(context, message);
  }
}
