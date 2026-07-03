import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderService {
  getOrderList(): string {
    return 'get order list';
  }
}
