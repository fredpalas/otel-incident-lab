export interface PlaceOrderCommand {
  readonly customerId: string;
  readonly eventId: string;
  readonly tickets: number;
}
