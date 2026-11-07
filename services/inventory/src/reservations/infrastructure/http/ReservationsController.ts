import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ReservationService } from '../../application/ReservationService';
import type { ReservationDto } from '../../domain/ReservationDto';
import { parseReserveSeatsRequest } from './ReserveSeatsRequest';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationService) {}

  @Post()
  @HttpCode(201)
  reserve(@Body() body: unknown): Promise<ReservationDto> {
    return this.reservations.reserve(parseReserveSeatsRequest(body));
  }
}
