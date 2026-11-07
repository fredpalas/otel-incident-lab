export interface ReservationDto {
  readonly orderId: string;
  readonly eventId: string;
  readonly seatIds: string[];
}
