import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('info')
  getUserInfo(): string {
    return this.userService.getUserInfo();
  }

  @Get('info/:id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Get('list')
  getUserList(
    @Query('pageNum') pageNum: number,
    @Query('pageSize') pageSize: number,
  ) {
    return this.userService.getUserList({ pageNum, pageSize });
  }

  @Post('create')
  createUser(@Body() user: User) {
    return this.userService.createUser(user);
  }
}
