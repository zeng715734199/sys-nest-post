import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello zlh!';
  }
  getZlh(): any {
    return { code: 200, msg: '我叫曾林煌' };
  }
}
