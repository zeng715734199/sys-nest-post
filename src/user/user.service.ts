import { Injectable } from '@nestjs/common';
import { MailService } from './mail.service';
import {CreateUserDto} from "./dto/create-user.dto";
import {PrismaService} from "../prisma/prisma.service";
import {UserFindManyArgs, UserFindUniqueArgs} from "../generated/prisma/models/User";
import {UpdateUserDto} from "./dto/update-user.dto";
import {QueryUserDto} from "./dto/query-user.dto";

@Injectable()
export class UserService {
  constructor(
      private readonly prismaService: PrismaService
  ) {}
  async findAll(query: QueryUserDto) {
    // URL 传来的参数都是字符串，这里转成数字并设默认值
    // page 不传则默认第 1 页
    const page = Number(query.page) || 1
    // pageSize 不传则默认每页 10 条，最大限制 100 防止一次查太多
    const pageSize = Math.min(Number(query.pageSize) || 10, 100)
    // skip：跳过前面多少条记录（分页偏移量）
    // 第 1 页：skip = (1-1) × 10 = 0，从第 1 条开始取
    // 第 2 页：skip = (2-1) × 10 = 10，从第 11 条开始取
    // 第 3 页：skip = (3-1) × 10 = 20，从第 21 条开始取
    const skip = (page - 1) * pageSize
    const where: any = {}
    // name 搜索：模糊匹配，contains 相当于 SQL 的 LIKE '%xxx%'
    // mode: 'insensitive' 表示忽略大小写（PostgreSQL 专用配置）
    if(query.name) {
      where.name = { contains: query.name, mode: 'insensitive' }
    }
    // 精确匹配过滤
    if(query.email) {
      where.email = query.email
    }
    // 精确匹配过滤
    if(query.role) {
      where.role = query.role
    }
    // 使用 prisma.$transaction 同时执行两个查询，保证在同一"事务"内
    // 好处：total 和 list 基于同一时刻的数据，不会因为并发写入导致数据不一致
    const [total, list] = await this.prismaService.$transaction([
      // 第一个查询：统计满足条件的总记录数（用于前端计算总页数）
      // count 不受 skip/take 影响，统计的是全部满足 where 条件的数量
      this.prismaService.user.count({ where }),
      // 第二个查询：查询当前页的数据列表
      this.prismaService.user.findMany({
        where,         // 过滤条件（同上）
        skip,          // 跳过前面的记录
        take: pageSize,// 取当前页的数据条数
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        // 按创建时间降序排列，最新注册的用户在前面
        orderBy: { createdAt: 'desc' },
      } as UserFindManyArgs)
    ])
    const totalPages = Math.ceil(total / pageSize)
    return {
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
      list,
    }
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
