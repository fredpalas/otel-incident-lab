export interface CheckoutCommand {
  readonly customerId: string;
  readonly eventId: string;
  readonly tickets: number;
}
