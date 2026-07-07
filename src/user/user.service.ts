import { Injectable } from '@nestjs/common';
import { MailService } from './mail.service';
import {CreateUserDto} from "./dto/create-user.dto";
import {PrismaService} from "../prisma/prisma.service";
import {UserFindManyArgs, UserFindUniqueArgs} from "../generated/prisma/models/User";
import {UpdateUserDto} from "./dto/update-user.dto";

@Injectable()
export class UserService {
  constructor(
      private readonly mailService: MailService,
      private readonly prismaService: PrismaService
  ) {}
  async findAll() {
    const list = await this.prismaService.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    } as UserFindManyArgs)
    return { success: true, msg: null, data: list }
  }
  async getUserById(id: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        // 联表查询该用户的所有文章
        posts: {
          select: {
            id: true,
            title: true,
            published: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    } as UserFindUniqueArgs)
    if (!user) {
      return { success: false, message: `用户 ID ${id} 不存在` }
    }
    return { success: true, msg: '成功', data: user }
  }

  async addUser(userDto: CreateUserDto){
    const post = await this.prismaService.user.create({
      data: {
        name: userDto.name,
        email: userDto.email,
        password: userDto.password,
        role: userDto.role ?? 'user',
      },
    });
    return { code: 200, msg: '创建用户成功', data: post };
  }
  // name?: string
  // email?: string
  // password?: string
  // role?: string
  async updateUser({ id, user }: { id: string; user: UpdateUserDto }) {
    try {
      const data = await this.prismaService.user.update({
        where: { id: parseInt(id) },
        data: {
          name: user.name,
          email: user.email,
          password: user.password,
          role: user.role,
        },
      })
      return { code: 200, msg: '更新用户成功', data}
    } catch {
      return { success: false, msg: `更新失败：未找到对应用户` }
    }
  }
  async deleteUser(id: string) {
    try {
      const data = await this.prismaService.user.delete({ where: { id: parseInt(id) } })
      return { success: true, msg: '删除成功', data }
    } catch {
      return { success: false, msg: `删除失败：未找到对应用户` }
    }
  }
}
