export interface PayCommand {
  readonly orderId: string;
  readonly customerId: string;
  readonly amountCents: number;
  readonly currency: string;
}
