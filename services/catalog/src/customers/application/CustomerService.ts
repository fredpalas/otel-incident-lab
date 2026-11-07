import { Injectable } from '@nestjs/common';
import { Customer } from '../domain/Customer';
import type { CustomerDto } from '../domain/CustomerDto';
import { CustomerId } from '../domain/CustomerId';
import { CustomerRepository } from '../domain/CustomerRepository';

@Injectable()
export class CustomerService {
  constructor(private readonly customers: CustomerRepository) {}

  async find(idValue: string): Promise<CustomerDto> {
    const id = CustomerId.of(idValue);
    return ((await this.customers.find(id)) ?? Customer.guest(id)).toDto();
  }
}
