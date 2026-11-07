import type { Customer } from './Customer';
import type { CustomerId } from './CustomerId';

export abstract class CustomerRepository {
  abstract find(id: CustomerId): Promise<Customer | undefined>;
}
