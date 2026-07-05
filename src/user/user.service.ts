import { Injectable } from '@nestjs/common';
import { User, Pager } from './user';
import { MailService } from './mail.service';

@Injectable()
export class UserService {
  constructor(private readonly mailService: MailService) {}
  getUserInfo(): string {
    return 'get user';
  }
  getUserById(id: string) {
    return {
      id,
      name: 'xxx',
      gender: 1,
      createTime: Date.now(),
    };
  }
  getUserList({ pageNum, pageSize }: Pager) {
    console.log(pageNum, pageSize, 'pager');
    return [];
  }
  createUser(userInfo: User): User {
    const info = {
      id: Math.random().toString(),
      name: userInfo.name,
      gender: userInfo.gender,
      createTime: Date.now(),
    };
    this.mailService.sendMail(info);
    return info;
  }
}
