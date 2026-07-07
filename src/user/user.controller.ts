import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import {CreateUserDto} from "./dto/create-user.dto";
import {UpdateUserDto} from "./dto/update-user.dto";
import {QueryUserDto} from "./dto/query-user.dto";

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Get('list')
  findAll(@Query () query: QueryUserDto) {
    return this.userService.findAll(query);
  }
  @Post('add')
  addUser(@Body() user: CreateUserDto) {
    return this.userService.addUser(user);
  }
  @Get('/:id')
  getUserById(@Param('id') id: string) {
    return this.userService.getUserById(id);
  }

  @Delete('delete/:id')
  deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(id);
  }

  @Put('update/:id')
  updateUser(@Param('id') id: string, @Body() user: UpdateUserDto) {
    return this.userService.updateUser({ id, user });
  }
}
