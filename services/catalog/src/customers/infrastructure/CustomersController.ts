import { Controller, Get, Param } from '@nestjs/common';
import { CustomerService } from '../application/CustomerService';
import type { CustomerDto } from '../domain/CustomerDto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomerService) {}

  @Get(':id')
  find(@Param('id') id: string): Promise<CustomerDto> {
    return this.customers.find(id);
  }
}
