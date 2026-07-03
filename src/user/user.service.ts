import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  getUserInfo(): string {
    return 'get user';
  }
}
