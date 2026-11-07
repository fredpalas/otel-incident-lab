export interface OrderDto {
  readonly id: string;
  readonly customerId: string;
  readonly eventId: string;
  readonly tickets: number;
  readonly amountCents: number;
  readonly currency: string;
  readonly status: string;
  readonly createdAt: string;
}
