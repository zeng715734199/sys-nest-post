import { Injectable } from '@nestjs/common';
import { User, Pager } from './user';
import { MailService } from './mail.service';

@Injectable()
export class UserService {
  constructor(private readonly mailService: MailService) {}
  // mock用户数据
  users: User[] = [
    {
      id: '111',
      name: '阿明',
      gender: 1,
      createTime: Date.now(),
    },
    {
      id: '222',
      name: '阿潘',
      gender: 1,
      createTime: Date.now(),
    },
    {
      id: '333',
      name: '小美',
      gender: 0,
      createTime: Date.now(),
    },
  ];
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
  updateUser({ id, user }: { id: string; user: User }) {
    const index = this.users.findIndex((item) => item.id === id);
    if (index === -1) {
      return { code: 500, msg: '未找到对应用户' };
    }
    this.users[index] = user;
    return { code: 200, msg: '更新成功', user };
  }
  deleteUser(id: string) {
    const index = this.users.findIndex((item) => item.id === id);
    if (index === -1) {
      return { code: 500, msg: '未找到对应用户' };
    }
    const removedUserList = this.users.splice(index, 1);
    return { code: 200, msg: '删除成功', user: removedUserList[0] };
  }
}
