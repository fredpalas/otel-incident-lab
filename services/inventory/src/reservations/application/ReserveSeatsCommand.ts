export interface ReserveSeatsCommand {
  orderId: string;
  eventId: string;
  seats: number;
}
