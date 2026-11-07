export interface SeatDto {
  readonly id: string;
  readonly eventId: string;
  readonly status: string;
  readonly orderId?: string;
}
