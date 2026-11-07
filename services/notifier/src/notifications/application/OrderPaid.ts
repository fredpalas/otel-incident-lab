export interface OrderPaid {
  readonly orderId: string;
  readonly customerId: string;
  readonly eventId: string;
  readonly tickets: number;
  readonly amountCents: number;
  readonly currency: string;
}
