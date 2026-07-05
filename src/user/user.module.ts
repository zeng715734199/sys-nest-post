import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { MailService } from './mail.service';

@Module({
  controllers: [UserController],
  providers: [UserService, MailService],
})
export class UserModule {}
